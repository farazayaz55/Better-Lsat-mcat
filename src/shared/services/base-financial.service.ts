import { Injectable } from '@nestjs/common';
import { Repository, ObjectLiteral } from 'typeorm';
import { AppLogger } from '../logger/logger.service';
import { RequestContext } from '../request-context/request-context.dto';

/**
 * Base service for common financial operations
 */
@Injectable()
export abstract class BaseFinancialService<T extends ObjectLiteral> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly logger: AppLogger,
  ) {
    this.logger.setContext(this.constructor.name);
  }

  /**
   * Find entity by ID
   */
  async findById(ctx: RequestContext, id: number): Promise<T | null> {
    this.logger.log(ctx, `Finding entity by ID: ${id}`);
    return this.repository.findOne({ where: { id } as any });
  }

  /**
   * Find entities by order ID
   */
  async findByOrderId(ctx: RequestContext, orderId: number): Promise<T[]> {
    this.logger.log(ctx, `Finding entities by order ID: ${orderId}`);
    return this.repository.find({ where: { orderId } as any });
  }

  /**
   * Find entities by customer ID
   */
  async findByCustomerId(
    ctx: RequestContext,
    customerId: number,
  ): Promise<T[]> {
    this.logger.log(ctx, `Finding entities by customer ID: ${customerId}`);
    return this.repository.find({ where: { customerId } as any });
  }

  /**
   * Find entities by date range
   */
  async findByDateRange(
    ctx: RequestContext,
    startDate: Date,
    endDate: Date,
  ): Promise<T[]> {
    this.logger.log(
      ctx,
      `Finding entities by date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );
    return this.repository.find({
      where: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      } as any,
    });
  }

  /**
   * Count entities by status
   */
  async countByStatus(ctx: RequestContext, status: string): Promise<number> {
    this.logger.log(ctx, `Counting entities by status: ${status}`);
    return this.repository.count({ where: { status } as any });
  }

  /**
   * Count entities by date range
   */
  async countByDateRange(
    ctx: RequestContext,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    this.logger.log(
      ctx,
      `Counting entities by date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );
    return this.repository.count({
      where: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      } as any,
    });
  }
}
