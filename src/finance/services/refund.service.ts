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
import { StripeService } from '../../shared/services/stripe.service';
import { OrderService } from '../../order/services/order.service';
import { PaymentService } from '../../order/services/payment.service';
import { InvoiceService } from '../../invoicing/services/invoice.service';
import { FINANCIAL_CONSTANTS } from '../../shared/constants/financial.constant';
import { PaymentStatus } from '../../order/interfaces/stripe-metadata.interface';
import { PaymentTransactionService } from './payment-transaction.service';
import { TransactionType } from '../constants/finance.constant';

export interface CreateRefundDto {
  originalOrderId: number;
  customerId: number;
  amount: number;
  currency?: string;
  reason: RefundReason;
  reasonDetails: string;
  newOrderId?: number;
  invoiceId?: number; // Make optional - will be auto-discovered
}

export interface ProcessRefundDto {
  stripeRefundId?: string;
}

export interface CancelRefundDto {
  reason: string;
}

@Injectable()
export class RefundService extends BaseFinancialService<Refund> {
  constructor(
    @InjectRepository(Refund)
    protected readonly repository: Repository<Refund>,
    private readonly refundRepository: RefundRepository,
    private readonly stripeService: StripeService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly invoiceService: InvoiceService,
    private readonly configService: ConfigService,
    private readonly financialNumberService: FinancialNumberService,
    private readonly paymentTransactionService: PaymentTransactionService,
    protected readonly logger: AppLogger,
  ) {
    super(repository, logger);
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
    const invoice = await this.getInvoiceByOrderId(ctx, data.originalOrderId);
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
      const invoices = await this.invoiceService.getInvoicesByOrderId(
        ctx,
        data.originalOrderId,
      );
      if (invoices.length === 0) {
        throw new NotFoundException(
          `No invoice found for order ${data.originalOrderId}`,
        );
      }
      invoiceId = invoices[0].id;
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

  private async getInvoiceByOrderId(
    ctx: RequestContext,
    orderId: number,
  ): Promise<any> {
    this.logger.log(ctx, `Getting invoice for order ${orderId}`);
    const invoices = await this.invoiceService.getInvoicesByOrderId(
      ctx,
      orderId,
    );
    return invoices.length > 0 ? invoices[0] : null;
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

    const refund = await this.refundRepository.findById(refundId);
    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new RefundProcessingError(
        `Refund ${refundId} is not in pending status`,
        refundId,
      );
    }

    try {
      // Update status to processing
      await this.refundRepository.update(refundId, {
        status: RefundStatus.PROCESSING,
      });

      // Get the original order to find the payment intent
      const order = await this.orderService.findOne(refund.originalOrderId);
      if (!order) {
        throw new NotFoundException(
          `Order ${refund.originalOrderId} not found`,
        );
      }

      // Extract payment intent ID from order's stripe metadata
      let paymentIntentId = order.stripe_meta?.paymentIntentId;

      // If no payment intent ID, try to get it from checkout session
      if (!paymentIntentId && order.stripe_meta?.checkoutSessionId) {
        try {
          this.logger.log(
            ctx,
            `No payment intent ID found, retrieving from checkout session: ${order.stripe_meta.checkoutSessionId}`,
          );

          // Retrieve the checkout session to get the payment intent
          const session = await this.stripeService.retrieveCheckoutSession(
            ctx,
            order.stripe_meta.checkoutSessionId,
          );

          if (session.payment_intent) {
            paymentIntentId =
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent.id;

            this.logger.log(
              ctx,
              `Found payment intent ${paymentIntentId} from checkout session`,
            );

            // Update the order's stripe_meta with the payment intent ID for future use
            await this.paymentService.updateStripeMeta(
              ctx,
              refund.originalOrderId,
              {
                ...order.stripe_meta,
                paymentIntentId,
              },
            );
          }
        } catch (error) {
          this.logger.error(
            ctx,
            `Failed to retrieve payment intent from checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      if (!paymentIntentId) {
        this.logger.error(
          ctx,
          `Order ${refund.originalOrderId} stripe_meta: ${JSON.stringify(order.stripe_meta)}`,
        );
        throw new Error(
          `No payment intent found for order ${refund.originalOrderId}. ` +
            `This order may have been created before payment processing was implemented, ` +
            `or the payment intent creation failed. ` +
            `Available stripe_meta fields: ${order.stripe_meta ? Object.keys(order.stripe_meta).join(', ') : 'none'}`,
        );
      }

      // Map refund reason to Stripe reason
      const stripeReason = this.mapRefundReasonToStripe(refund.reason);

      // Get the original payment currency from order metadata
      const originalPaymentCurrency =
        order.stripe_meta?.paidCurrency?.toUpperCase() ||
        order.stripe_meta?.currency?.toUpperCase() ||
        'CAD';

      this.logger.log(
        ctx,
        `Refund amount in CAD: ${refund.amount}, Original payment currency: ${originalPaymentCurrency}`,
      );

      // Convert refund amount from CAD to original payment currency if needed
      let refundAmountForStripe = Math.round(refund.amount);

      if (originalPaymentCurrency !== 'CAD') {
        try {
          // Get exchange rates from CAD to original payment currency
          const rates = await this.stripeService.getExchangeRates(ctx, 'CAD');
          const conversionRate = rates.rates[originalPaymentCurrency];

          if (conversionRate) {
            refundAmountForStripe = Math.round(refund.amount * conversionRate);
            this.logger.log(
              ctx,
              `Converted refund amount from CAD to ${originalPaymentCurrency}: ${refund.amount} CAD * ${conversionRate} = ${refundAmountForStripe} ${originalPaymentCurrency}`,
            );
          } else {
            this.logger.warn(
              ctx,
              `Could not find exchange rate for ${originalPaymentCurrency}, using CAD amount as-is`,
            );
          }
        } catch (error) {
          this.logger.warn(
            ctx,
            `Failed to convert refund amount: ${error instanceof Error ? error.message : 'Unknown error'}, using CAD amount as-is`,
          );
        }
      }

      // Create refund in Stripe with converted amount
      const stripeRefund = await this.stripeService.createRefund(ctx, {
        paymentIntentId,
        amount: refundAmountForStripe, // Amount in original payment currency
        reason: stripeReason,
        metadata: {
          refundId: refund.id.toString(),
          refundNumber: refund.refundNumber,
          originalOrderId: refund.originalOrderId.toString(),
          customerId: refund.customerId.toString(),
          refundAmountInCad: refund.amount.toString(), // Store original CAD amount for reference
          refundAmountInPaymentCurrency: refundAmountForStripe.toString(),
          originalPaymentCurrency,
        },
      });

      // ✅ ADD THIS: Void the invoice automatically
      await this.invoiceService.voidInvoice(
        ctx,
        refund.invoiceId,
        `Refund processed: ${refund.reasonDetails}`,
      );

      // ✅ ADD THIS: Update original order status to CANCELED
      await this.orderService.updateOrderStatus(
        ctx,
        refund.originalOrderId,
        PaymentStatus.CANCELED,
        `Refund processed: ${refund.reasonDetails}`,
        refund.id,
      );

      // ✅ ADD THIS: Cancel slot reservation
      await this.orderService.cancelSlotReservation(
        ctx,
        refund.originalOrderId,
        `Refund processed: ${refund.reasonDetails}`,
      );

      // Update refund with Stripe refund ID and completed status
      await this.refundRepository.update(refundId, {
        status: RefundStatus.COMPLETED,
        stripeRefundId: stripeRefund.id,
        refundedAt: new Date(),
        processedBy: ctx.user?.id, // Track who processed the refund
        metadata: {
          refundAmountInCad: refund.amount,
          refundAmountInPaymentCurrency: refundAmountForStripe,
          originalPaymentCurrency,
        },
      });

      const updatedRefund = await this.refundRepository.findById(refundId);
      if (!updatedRefund) {
        throw new Error(`Failed to retrieve updated refund ${refundId}`);
      }

      // ✅ Create payment transaction for the refund
      try {
        await this.paymentTransactionService.createPaymentTransaction(ctx, {
          orderId: refund.originalOrderId,
          customerId: refund.customerId,
          type: TransactionType.REFUND,
          amount: refund.amount,
          currency: refund.currency,
          paymentMethod: 'card', // Default for Stripe refunds
          stripePaymentIntentId: order.stripe_meta?.paymentIntentId,
          stripeChargeId: stripeRefund.id,
          status: 'succeeded',
          invoiceId: refund.invoiceId,
          metadata: {
            refundId: updatedRefund.id.toString(),
            refundNumber: updatedRefund.refundNumber,
            stripeRefundId: stripeRefund.id,
            reason: refund.reason,
            reasonDetails: refund.reasonDetails,
          },
        });

        this.logger.log(
          ctx,
          `Created payment transaction for refund ${refundId}`,
        );
      } catch (transactionError) {
        this.logger.error(
          ctx,
          `Failed to create payment transaction for refund ${refundId}: ${
            transactionError instanceof Error
              ? transactionError.message
              : 'Unknown error'
          }`,
        );
        // Don't throw - we don't want to fail the refund if transaction creation fails
      }

      this.logger.log(
        ctx,
        `Successfully processed refund ${refundId} with Stripe refund ID: ${stripeRefund.id}`,
      );
      return updatedRefund;
    } catch (error) {
      // Update refund status to failed
      await this.refundRepository.update(refundId, {
        status: RefundStatus.FAILED,
      });

      this.logger.error(
        ctx,
        `Failed to process refund ${refundId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
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

  private mapRefundReasonToStripe(
    reason: RefundReason,
  ): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    switch (reason) {
      case RefundReason.DUPLICATE:
        return 'duplicate';
      case RefundReason.FRAUDULENT:
        return 'fraudulent';
      case RefundReason.CUSTOMER_REQUEST:
        return 'requested_by_customer';
      default:
        return 'requested_by_customer';
    }
  }
}
