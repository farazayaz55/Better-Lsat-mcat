import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BaseFinancialService } from '../../shared/services/base-financial.service';
import { FinancialNumberService } from '../../shared/services/financial-number.service';
import { RefundProcessingError } from '../../shared/exceptions/financial.exceptions';
import {
  RefundRepository,
  RefundFilter,
} from '../repositories/refund.repository';
import { Refund } from '../entities/refund.entity';
import { RefundStatus, RefundReason } from '../constants/finance.constant';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { OrderService } from '../../order/services/order.service';
import { FINANCIAL_CONSTANTS } from '../../shared/constants/financial.constant';
import { InvoiceDiscoveryService } from '../../invoicing/services/invoice-discovery.service';
import {
  CreateRefundDto,
  ProcessRefundDto,
  CancelRefundDto,
} from '../dto/refund.dto';
import { RefundProcessingOrchestrator } from './refund-processing/refund-processing-orchestrator.service';

@Injectable()
export class RefundService extends BaseFinancialService<Refund> {
  constructor(
    @InjectRepository(Refund)
    protected readonly repository: Repository<Refund>,
    private readonly refundRepository: RefundRepository,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly invoiceDiscoveryService: InvoiceDiscoveryService,
    private readonly configService: ConfigService,
    private readonly financialNumberService: FinancialNumberService,
    private readonly refundOrchestrator: RefundProcessingOrchestrator,
    protected readonly logger: AppLogger,
  ) {
    super(repository, logger);
  }

  /**
   * Finds the invoice for an order
   */
  private async findInvoiceForOrder(
    ctx: RequestContext,
    orderId: number,
  ): Promise<{ id: number } | null> {
    return this.invoiceDiscoveryService.findInvoiceForOrder(ctx, orderId);
  }

  /**
   * Creates a refund record without authentication (for webhook processing)
   */
  async createRefundFromWebhook(
    ctx: RequestContext,
    data: Omit<CreateRefundDto, 'invoiceId'>,
  ): Promise<Refund> {
    this.logger.log(
      ctx,
      `Creating refund from webhook for order ${data.originalOrderId}`,
    );

    // Auto-discover the invoice ID from the order
    const invoice = await this.findInvoiceForOrder(ctx, data.originalOrderId);
    if (!invoice) {
      throw new Error(`No invoice found for order ${data.originalOrderId}`);
    }

    const refundNumber =
      await this.financialNumberService.generateRefundNumber();

    const newRefund = await this.refundRepository.create({
      ...data,
      invoiceId: invoice.id, // Auto-populated
      refundNumber,
      status: RefundStatus.PENDING,
      currency: data.currency || FINANCIAL_CONSTANTS.DEFAULT_CURRENCY,
      initiatedBy: ctx.user?.id, // Track who initiated the refund
    });

    this.logger.log(
      ctx,
      `Created refund ${newRefund.refundNumber} with ID ${newRefund.id}`,
    );
    return newRefund;
  }

  async createRefund(
    ctx: RequestContext,
    data: CreateRefundDto,
  ): Promise<Refund> {
    this.logger.log(ctx, `Creating refund for order ${data.originalOrderId}`);

    // Get the order to inherit its currency
    const order = await this.orderService.findOne(data.originalOrderId);
    if (!order) {
      throw new NotFoundException(`Order ${data.originalOrderId} not found`);
    }

    // Automatically find the invoice for the order if not provided
    let invoiceId = data.invoiceId;
    if (!invoiceId) {
      const invoice = await this.findInvoiceForOrder(ctx, data.originalOrderId);
      if (!invoice) {
        throw new NotFoundException(
          `No invoice found for order ${data.originalOrderId}`,
        );
      }
      invoiceId = invoice.id;
      this.logger.log(
        ctx,
        `Auto-found invoice ${invoiceId} for order ${data.originalOrderId}`,
      );
    }

    const refundNumber =
      await this.financialNumberService.generateRefundNumber();

    // Use order currency or fallback to provided currency or CAD
    const refundCurrency =
      data.currency || order.currency || FINANCIAL_CONSTANTS.DEFAULT_CURRENCY;

    const refund = await this.refundRepository.create({
      refundNumber,
      originalOrderId: data.originalOrderId,
      customerId: data.customerId,
      amount: data.amount,
      currency: refundCurrency,
      reason: data.reason,
      reasonDetails: data.reasonDetails,
      newOrderId: data.newOrderId,
      invoiceId,
      status: RefundStatus.PENDING,
      initiatedBy: ctx.user?.id, // Track who initiated the refund
    });

    this.logger.log(
      ctx,
      `Created refund ${refund.refundNumber} with ID ${refund.id}`,
    );

    // ✅ AUTOMATICALLY PROCESS THE REFUND
    try {
      this.logger.log(
        ctx,
        `Automatically processing refund ${refund.id} after creation`,
      );

      const processedRefund = await this.processRefund(ctx, refund.id, {});

      this.logger.log(
        ctx,
        `Successfully processed refund ${refund.id} automatically`,
      );

      return processedRefund;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to automatically process refund ${refund.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Return the created refund even if processing failed
      // This allows manual processing later
      this.logger.log(
        ctx,
        `Refund ${refund.id} created but requires manual processing`,
      );

      return refund;
    }
  }

  async getRefundById(
    ctx: RequestContext,
    refundId: number,
  ): Promise<Refund | null> {
    this.logger.log(ctx, `Getting refund ${refundId}`);
    return this.refundRepository.findById(refundId);
  }

  async getRefundByNumber(
    ctx: RequestContext,
    refundNumber: string,
  ): Promise<Refund | null> {
    this.logger.log(ctx, `Getting refund by number ${refundNumber}`);
    return this.refundRepository.findByRefundNumber(refundNumber);
  }

  async getRefundByStripeId(
    ctx: RequestContext,
    stripeRefundId: string,
  ): Promise<Refund | null> {
    this.logger.log(ctx, `Getting refund by Stripe ID ${stripeRefundId}`);
    const result =
      await this.refundRepository.findByStripeRefundId(stripeRefundId);
    this.logger.log(
      ctx,
      `Refund query result: ${result ? `Found refund ${result.id}` : 'No refund found'}`,
    );
    return result;
  }

  async updateRefundStatus(
    ctx: RequestContext,
    refundId: number,
    status: RefundStatus,
    stripeRefundId?: string,
  ): Promise<Refund> {
    this.logger.log(ctx, `Updating refund ${refundId} status to ${status}`);

    const updateData: Partial<Refund> = { status };

    if (stripeRefundId) {
      updateData.stripeRefundId = stripeRefundId;
    }

    if (status === RefundStatus.COMPLETED) {
      updateData.refundedAt = new Date();
    }

    await this.refundRepository.update(refundId, updateData);

    const updatedRefund = await this.refundRepository.findById(refundId);
    if (!updatedRefund) {
      throw new Error(`Failed to retrieve updated refund ${refundId}`);
    }

    return updatedRefund;
  }

  async updateRefund(
    ctx: RequestContext,
    refundId: number,
    updateData: Partial<Refund>,
  ): Promise<Refund> {
    this.logger.log(ctx, `Updating refund ${refundId}`);

    await this.refundRepository.update(refundId, updateData);

    const updatedRefund = await this.refundRepository.findById(refundId);
    if (!updatedRefund) {
      throw new Error(`Failed to retrieve updated refund ${refundId}`);
    }

    return updatedRefund;
  }

  async getRefundsByOriginalOrderId(
    ctx: RequestContext,
    originalOrderId: number,
  ): Promise<Refund[]> {
    this.logger.log(
      ctx,
      `Getting refunds for original order ${originalOrderId}`,
    );
    return this.refundRepository.findByOriginalOrderId(originalOrderId);
  }

  async getRefundsByCustomerId(
    ctx: RequestContext,
    customerId: number,
  ): Promise<Refund[]> {
    this.logger.log(ctx, `Getting refunds for customer ${customerId}`);
    return this.refundRepository.findByCustomerId(customerId);
  }

  async getRefundsWithFilters(
    ctx: RequestContext,
    filter: RefundFilter,
  ): Promise<Refund[]> {
    this.logger.log(
      ctx,
      `Getting refunds with filters: ${JSON.stringify(filter)}`,
    );
    return this.refundRepository.findWithFilters(filter);
  }

  async processRefund(
    ctx: RequestContext,
    refundId: number,
    processData: ProcessRefundDto,
  ): Promise<Refund> {
    this.logger.log(ctx, `Processing refund ${refundId}`);
    return this.refundOrchestrator.processRefund(ctx, refundId, processData);
  }

  async cancelRefund(
    ctx: RequestContext,
    refundId: number,
    cancelData: CancelRefundDto,
  ): Promise<Refund> {
    this.logger.log(ctx, `Cancelling refund ${refundId}`);

    const refund = await this.refundRepository.findById(refundId);
    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    if (refund.status === RefundStatus.COMPLETED) {
      throw new Error(`Cannot cancel completed refund ${refundId}`);
    }

    await this.refundRepository.update(refundId, {
      status: RefundStatus.CANCELLED,
      reasonDetails: `${refund.reasonDetails} - Cancelled: ${cancelData.reason}`,
    });

    const updatedRefund = await this.refundRepository.findById(refundId);
    if (!updatedRefund) {
      throw new Error(`Failed to retrieve updated refund ${refundId}`);
    }

    this.logger.log(ctx, `Cancelled refund ${refundId}`);
    return updatedRefund;
  }

  async getRefundStats(ctx: RequestContext): Promise<{
    total: number;
    byStatus: Record<RefundStatus, number>;
    byReason: Record<RefundReason, number>;
    recentCount: number;
  }> {
    this.logger.log(ctx, 'Getting refund statistics');

    const statuses = Object.values(RefundStatus);
    const reasons = Object.values(RefundReason);

    const byStatus: Record<RefundStatus, number> = {} as any;
    const byReason: Record<RefundReason, number> = {} as any;

    for (const status of statuses) {
      byStatus[status] = await this.refundRepository.countByStatus(status);
    }

    for (const reason of reasons) {
      byReason[reason] = await this.refundRepository.count({
        where: { reason },
      });
    }

    const total = Object.values(byStatus).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Count refunds from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCount = await this.refundRepository.countByDateRange(
      thirtyDaysAgo,
      new Date(),
    );

    return {
      total,
      byStatus,
      byReason,
      recentCount,
    };
  }
}
