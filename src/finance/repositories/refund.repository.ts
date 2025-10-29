import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseFinancialRepository } from '../../shared/repositories/base-financial.repository';
import { Refund } from '../entities/refund.entity';
import { RefundStatus } from '../constants/finance.constant';

export interface RefundFilter {
  status?: RefundStatus;
  customerId?: number;
  orderId?: number;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class RefundRepository extends BaseFinancialRepository<Refund> {
  constructor(
    @InjectRepository(Refund)
    repository: Repository<Refund>,
  ) {
    super(repository);
  }

  async create(refund: Partial<Refund>): Promise<Refund> {
    const newRefund = this.repository.create(refund);
    return this.repository.save(newRefund);
  }

  async findById(id: number): Promise<Refund | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByRefundNumber(refundNumber: string): Promise<Refund | null> {
    return this.repository.findOne({ where: { refundNumber } });
  }

  async findByStripeRefundId(stripeRefundId: string): Promise<Refund | null> {
    try {
      // Try different query approaches for better reliability
      const result1 = await this.repository.findOne({
        where: { stripeRefundId },
      });
      if (result1) {
        return result1;
      }

      // Fallback: Try with explicit column name using query builder
      const result2 = await this.repository
        .createQueryBuilder('refund')
        .where('refund.stripeRefundId = :stripeRefundId', { stripeRefundId })
        .getOne();

      return result2;
    } catch (error) {
      console.error(`[ERROR] findByStripeRefundId failed:`, error);
      throw error;
    }
  }

  async findByOriginalOrderId(originalOrderId: number): Promise<Refund[]> {
    return this.repository.find({ where: { originalOrderId } });
  }

  async findAll(
    limit: number,
    offset: number,
    status?: RefundStatus,
  ): Promise<{ refunds: Refund[]; count: number }> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [refunds, count] = await this.repository.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return { refunds, count };
  }

  async update(id: number, updateData: Partial<Refund>): Promise<void> {
    await this.repository.update(id, updateData as any);
  }

  async findWithFilters(filter: RefundFilter): Promise<Refund[]> {
    const queryBuilder = this.repository.createQueryBuilder('refund');

    if (filter.status) {
      queryBuilder.andWhere('refund.status = :status', {
        status: filter.status,
      });
    }

    if (filter.customerId) {
      queryBuilder.andWhere('refund.customerId = :customerId', {
        customerId: filter.customerId,
      });
    }

    if (filter.orderId) {
      queryBuilder.andWhere('refund.orderId = :orderId', {
        orderId: filter.orderId,
      });
    }

    if (filter.startDate && filter.endDate) {
      queryBuilder.andWhere(
        'refund.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: filter.startDate,
          endDate: filter.endDate,
        },
      );
    }

    return queryBuilder.getMany();
  }

  async count(where: any): Promise<number> {
    return this.repository.count({ where });
  }
}
