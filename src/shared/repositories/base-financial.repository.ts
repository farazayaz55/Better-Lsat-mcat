import { Repository, Between, ObjectLiteral } from 'typeorm';
import { Injectable } from '@nestjs/common';

/**
 * Base repository with common financial operations
 */
@Injectable()
export abstract class BaseFinancialRepository<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  /**
   * Find records by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<T[]> {
    return this.repository.find({
      where: {
        createdAt: Between(startDate, endDate),
      } as any,
    });
  }

  /**
   * Count records by date range
   */
  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        createdAt: Between(startDate, endDate),
      } as any,
    });
  }

  /**
   * Count records by status
   */
  async countByStatus(status: string): Promise<number> {
    return this.repository.count({ where: { status } as any });
  }

  /**
   * Find records by order ID
   */
  async findByOrderId(orderId: number): Promise<T[]> {
    return this.repository.find({ where: { orderId } as any });
  }

  /**
   * Find records by customer ID
   */
  async findByCustomerId(customerId: number): Promise<T[]> {
    return this.repository.find({ where: { customerId } as any });
  }

  /**
   * Get total amount by type and date range
   */
  async getTotalAmountByType(
    type: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const queryBuilder = this.repository
      .createQueryBuilder('entity')
      .select('SUM(entity.amount)', 'total')
      .where('entity.type = :type', { type });

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'entity.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate,
          endDate,
        },
      );
    }

    const result = await queryBuilder.getRawOne();
    return parseInt(result.total) || 0;
  }

  /**
   * Create query builder with alias
   */
  createQueryBuilder(alias: string) {
    return this.repository.createQueryBuilder(alias);
  }
}
