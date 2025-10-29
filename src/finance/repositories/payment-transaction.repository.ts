import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BaseFinancialRepository } from '../../shared/repositories/base-financial.repository';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { TransactionType } from '../constants/finance.constant';

export interface PaymentTransactionFilter {
  type?: TransactionType;
  customerId?: number;
  orderId?: number;
  invoiceId?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: string;
  currency?: string;
  sortBy?: 'createdAt' | 'amount' | 'status' | 'type';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

@Injectable()
export class PaymentTransactionRepository extends BaseFinancialRepository<PaymentTransaction> {
  constructor(
    @InjectRepository(PaymentTransaction)
    protected readonly repository: Repository<PaymentTransaction>,
  ) {
    super(repository);
  }

  async create(data: Partial<PaymentTransaction>): Promise<PaymentTransaction> {
    const transaction = this.repository.create(data);
    return this.repository.save(transaction);
  }

  async findById(id: number): Promise<PaymentTransaction | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByTransactionNumber(
    transactionNumber: string,
  ): Promise<PaymentTransaction | null> {
    return this.repository.findOne({ where: { transactionNumber } });
  }

  // findByOrderId and findByCustomerId are inherited from BaseFinancialRepository

  async findByStripePaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<PaymentTransaction | null> {
    return this.repository.findOne({ where: { stripePaymentIntentId } });
  }

  async findByStripeChargeId(
    stripeChargeId: string,
  ): Promise<PaymentTransaction | null> {
    return this.repository.findOne({ where: { stripeChargeId } });
  }

  async findWithFilters(
    filter: PaymentTransactionFilter,
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    const queryBuilder = this.repository.createQueryBuilder('transaction');

    // Apply filters
    if (filter.type) {
      queryBuilder.andWhere('transaction.type = :type', { type: filter.type });
    }

    if (filter.customerId) {
      queryBuilder.andWhere('transaction.customerId = :customerId', {
        customerId: filter.customerId,
      });
    }

    if (filter.orderId) {
      queryBuilder.andWhere('transaction.orderId = :orderId', {
        orderId: filter.orderId,
      });
    }

    if (filter.invoiceId) {
      queryBuilder.andWhere('transaction.invoiceId = :invoiceId', {
        invoiceId: filter.invoiceId,
      });
    }

    if (filter.status) {
      queryBuilder.andWhere('transaction.status = :status', {
        status: filter.status,
      });
    }

    if (filter.paymentMethod) {
      queryBuilder.andWhere('transaction.paymentMethod = :paymentMethod', {
        paymentMethod: filter.paymentMethod,
      });
    }

    if (filter.currency) {
      queryBuilder.andWhere('transaction.currency = :currency', {
        currency: filter.currency,
      });
    }

    if (filter.minAmount !== undefined) {
      queryBuilder.andWhere('transaction.amount >= :minAmount', {
        minAmount: filter.minAmount,
      });
    }

    if (filter.maxAmount !== undefined) {
      queryBuilder.andWhere('transaction.amount <= :maxAmount', {
        maxAmount: filter.maxAmount,
      });
    }

    if (filter.startDate && filter.endDate) {
      queryBuilder.andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filter.startDate,
          endDate: filter.endDate,
        },
      );
    }

    // Apply sorting
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'DESC';
    queryBuilder.orderBy(`transaction.${sortBy}`, sortOrder);

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply pagination
    if (filter.limit) {
      queryBuilder.limit(filter.limit);
    }

    if (filter.offset) {
      queryBuilder.offset(filter.offset);
    }

    const transactions = await queryBuilder.getMany();

    return { transactions, total };
  }

  async update(id: number, data: Partial<PaymentTransaction>): Promise<void> {
    await this.repository.update(id, data as any);
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async countByType(type: TransactionType): Promise<number> {
    return this.repository.count({ where: { type } });
  }

  // countByStatus and countByDateRange are inherited from BaseFinancialRepository

  async getTotalAmountByType(
    type: TransactionType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    // Use inherited method from BaseFinancialRepository
    return super.getTotalAmountByType(type as string, startDate, endDate);
  }
}
