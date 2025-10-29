import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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
export class PaymentTransactionRepository {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly repository: Repository<PaymentTransaction>,
  ) {}

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

  async findByOrderId(orderId: number): Promise<PaymentTransaction[]> {
    return this.repository.find({ where: { orderId } });
  }

  async findByCustomerId(customerId: number): Promise<PaymentTransaction[]> {
    return this.repository.find({ where: { customerId } });
  }

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

  async countByStatus(status: string): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });
  }

  async getTotalAmountByType(
    type: TransactionType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const queryBuilder = this.repository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.type = :type', { type });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'transaction.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    const result = await queryBuilder.getRawOne();
    return parseInt(result.total) || 0;
  }

  createQueryBuilder(alias: string) {
    return this.repository.createQueryBuilder(alias);
  }
}
