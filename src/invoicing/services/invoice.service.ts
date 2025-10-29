import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseFinancialService } from '../../shared/services/base-financial.service';
import { FinancialNumberService } from '../../shared/services/financial-number.service';
import { InvoiceGenerationError } from '../../shared/exceptions/financial.exceptions';
import {
  InvoiceRepository,
  InvoiceFilter,
} from '../repositories/invoice.repository';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceStatus } from '../constants/invoice-status.constant';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { CreateInvoiceDto } from '../dto/invoice-input.dto';
import { FINANCIAL_CONSTANTS } from '../../shared/constants/financial.constant';

@Injectable()
export class InvoiceService extends BaseFinancialService<Invoice> {
  constructor(
    @InjectRepository(Invoice)
    protected readonly repository: Repository<Invoice>,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly financialNumberService: FinancialNumberService,
    protected readonly logger: AppLogger,
  ) {
    super(repository, logger);
  }

  async createInvoice(
    ctx: RequestContext,
    data: CreateInvoiceDto,
  ): Promise<Invoice> {
    this.logger.log(ctx, `Creating invoice for order ${data.orderId}`);

    const invoiceNumber =
      await this.financialNumberService.generateInvoiceNumber();
    const issueDate = new Date();
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : new Date(
          Date.now() +
            FINANCIAL_CONSTANTS.DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000,
        );

    const invoice = await this.invoiceRepository.create({
      invoiceNumber,
      orderId: data.orderId,
      customerId: data.customerId,
      status: InvoiceStatus.DRAFT,
      issueDate: issueDate instanceof Date ? issueDate : new Date(issueDate),
      dueDate: dueDate,
      items: data.items,
      subtotal: data.subtotal,
      tax: data.tax || 0,
      discount: data.discount || 0,
      total: data.total,
      currency: data.currency || FINANCIAL_CONSTANTS.DEFAULT_CURRENCY,
      notes: data.notes,
      initiatedBy: ctx.user?.id, // Track who initiated the invoice
    });

    this.logger.log(
      ctx,
      `Created invoice ${invoice.invoiceNumber} with ID ${invoice.id}`,
    );
    return invoice;
  }

  async getInvoiceById(
    ctx: RequestContext,
    id: number,
  ): Promise<Invoice | null> {
    this.logger.log(ctx, `Getting invoice ${id}`);
    return this.invoiceRepository.findById(id);
  }

  async getInvoiceByNumber(
    ctx: RequestContext,
    invoiceNumber: string,
  ): Promise<Invoice | null> {
    this.logger.log(ctx, `Getting invoice by number ${invoiceNumber}`);
    return this.invoiceRepository.findByInvoiceNumber(invoiceNumber);
  }

  async getInvoicesByOrderId(
    ctx: RequestContext,
    orderId: number,
  ): Promise<Invoice[]> {
    this.logger.log(ctx, `Getting invoices for order ${orderId}`);
    return this.invoiceRepository.findByOrderId(orderId);
  }

  async getInvoicesByCustomerId(
    ctx: RequestContext,
    customerId: number,
  ): Promise<Invoice[]> {
    this.logger.log(ctx, `Getting invoices for customer ${customerId}`);
    return this.invoiceRepository.findByCustomerId(customerId);
  }

  async getInvoicesWithFilters(
    ctx: RequestContext,
    filter: InvoiceFilter,
  ): Promise<Invoice[]> {
    this.logger.log(
      ctx,
      `Getting invoices with filters: ${JSON.stringify(filter)}`,
    );
    return this.invoiceRepository.findWithFilters(filter);
  }

  async updateInvoiceStatus(
    ctx: RequestContext,
    id: number,
    status: InvoiceStatus,
  ): Promise<Invoice> {
    this.logger.log(ctx, `Updating invoice ${id} status to ${status}`);

    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Set paidDate when status is changed to PAID
    const updateData: any = { status };
    if (status === InvoiceStatus.PAID && !invoice.paidDate) {
      updateData.paidDate = new Date();
    }

    await this.invoiceRepository.update(id, updateData);

    const updatedInvoice = await this.invoiceRepository.findById(id);
    if (!updatedInvoice) {
      throw new Error(`Failed to retrieve updated invoice ${id}`);
    }

    this.logger.log(ctx, `Updated invoice ${id} status to ${status}`);
    return updatedInvoice;
  }

  async voidInvoice(
    ctx: RequestContext,
    id: number,
    reason: string,
  ): Promise<Invoice> {
    this.logger.log(ctx, `Voiding invoice ${id} with reason: ${reason}`);

    const invoice = await this.invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new Error(`Invoice ${id} is already voided`);
    }

    await this.invoiceRepository.update(id, {
      status: InvoiceStatus.VOID,
      voidedAt: new Date(),
      voidReason: reason,
    });

    const updatedInvoice = await this.invoiceRepository.findById(id);
    if (!updatedInvoice) {
      throw new Error(`Failed to retrieve updated invoice ${id}`);
    }

    this.logger.log(ctx, `Voided invoice ${id}`);
    return updatedInvoice;
  }

  async getInvoiceStats(ctx: RequestContext): Promise<{
    total: number;
    byStatus: Record<InvoiceStatus, number>;
    recentCount: number;
  }> {
    this.logger.log(ctx, 'Getting invoice statistics');

    const statuses = Object.values(InvoiceStatus);
    const byStatus: Record<InvoiceStatus, number> = {} as any;

    for (const status of statuses) {
      byStatus[status] = await this.invoiceRepository.countByStatus(status);
    }

    const total = Object.values(byStatus).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Count invoices from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCount = await this.invoiceRepository.countByDateRange(
      thirtyDaysAgo,
      new Date(),
    );

    return {
      total,
      byStatus,
      recentCount,
    };
  }
}
