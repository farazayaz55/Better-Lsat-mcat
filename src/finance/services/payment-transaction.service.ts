import { Injectable } from '@nestjs/common';
import {
  PaymentTransactionRepository,
  PaymentTransactionFilter,
} from '../repositories/payment-transaction.repository';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { TransactionType } from '../constants/finance.constant';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AppLogger } from '../../shared/logger/logger.service';

export interface CreatePaymentTransactionDto {
  orderId: number;
  customerId: number;
  type: TransactionType;
  amount: number;
  currency?: string;
  paymentMethod: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  status: string;
  metadata?: any;
  invoiceId?: number;
}

@Injectable()
export class PaymentTransactionService {
  constructor(
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(PaymentTransactionService.name);
  }

  async createPaymentTransaction(
    ctx: RequestContext,
    data: CreatePaymentTransactionDto,
  ): Promise<PaymentTransaction> {
    this.logger.log(
      ctx,
      `Creating payment transaction for order ${data.orderId}`,
    );

    const transactionNumber = await this.generateUniqueTransactionNumber();

    const transaction = await this.paymentTransactionRepository.create({
      transactionNumber,
      orderId: data.orderId,
      customerId: data.customerId,
      type: data.type,
      amount: data.amount,
      currency: data.currency || 'CAD', // Default to CAD for consistency
      paymentMethod: data.paymentMethod,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeChargeId: data.stripeChargeId,
      status: data.status,
      metadata: data.metadata || {},
      invoiceId: data.invoiceId,
    });

    this.logger.log(
      ctx,
      `Created payment transaction ${transaction.transactionNumber} with ID ${transaction.id}`,
    );
    return transaction;
  }

  async getTransactionById(
    ctx: RequestContext,
    transactionId: number,
  ): Promise<PaymentTransaction | null> {
    this.logger.log(ctx, `Getting payment transaction ${transactionId}`);
    return this.paymentTransactionRepository.findById(transactionId);
  }

  async getTransactionByNumber(
    ctx: RequestContext,
    transactionNumber: string,
  ): Promise<PaymentTransaction | null> {
    this.logger.log(
      ctx,
      `Getting payment transaction by number ${transactionNumber}`,
    );
    return this.paymentTransactionRepository.findByTransactionNumber(
      transactionNumber,
    );
  }

  async getTransactionsByOrderId(
    ctx: RequestContext,
    orderId: number,
  ): Promise<PaymentTransaction[]> {
    this.logger.log(ctx, `Getting payment transactions for order ${orderId}`);
    return this.paymentTransactionRepository.findByOrderId(orderId);
  }

  async getTransactionsByCustomerId(
    ctx: RequestContext,
    customerId: number,
  ): Promise<PaymentTransaction[]> {
    this.logger.log(
      ctx,
      `Getting payment transactions for customer ${customerId}`,
    );
    return this.paymentTransactionRepository.findByCustomerId(customerId);
  }

  async getTransactionsWithFilters(
    ctx: RequestContext,
    filter: PaymentTransactionFilter,
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    this.logger.log(
      ctx,
      `Getting payment transactions with filters: ${JSON.stringify(filter)}`,
    );
    return this.paymentTransactionRepository.findWithFilters(filter);
  }

  async getTransactionStats(ctx: RequestContext): Promise<{
    total: number;
    byType: Record<TransactionType, number>;
    byStatus: Record<string, number>;
    recentCount: number;
    totalRevenue: number;
    totalRefunds: number;
  }> {
    this.logger.log(ctx, 'Getting payment transaction statistics');

    const types = Object.values(TransactionType);
    const byType: Record<TransactionType, number> = {} as any;

    for (const type of types) {
      byType[type] = await this.paymentTransactionRepository.countByType(type);
    }

    // Get unique statuses and count them
    const statuses = ['succeeded', 'pending', 'failed', 'cancelled'];
    const byStatus: Record<string, number> = {};

    for (const status of statuses) {
      byStatus[status] =
        await this.paymentTransactionRepository.countByStatus(status);
    }

    const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

    // Count transactions from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCount =
      await this.paymentTransactionRepository.countByDateRange(
        thirtyDaysAgo,
        new Date(),
      );

    // Calculate total revenue and refunds
    const totalRevenue =
      await this.paymentTransactionRepository.getTotalAmountByType(
        TransactionType.PAYMENT,
        thirtyDaysAgo,
        new Date(),
      );

    const totalRefunds =
      await this.paymentTransactionRepository.getTotalAmountByType(
        TransactionType.REFUND,
        thirtyDaysAgo,
        new Date(),
      );

    return {
      total,
      byType,
      byStatus,
      recentCount,
      totalRevenue,
      totalRefunds,
    };
  }

  private async generateUniqueTransactionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TXN-${year}`;

    // Find the highest number for this year
    const lastTransaction = await this.paymentTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.transactionNumber LIKE :prefix', {
        prefix: `${prefix}-%`,
      })
      .orderBy('transaction.transactionNumber', 'DESC')
      .getOne();

    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(
        lastTransaction.transactionNumber.split('-')[2],
      );
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  }
}
