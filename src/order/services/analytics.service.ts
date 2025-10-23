import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { OrderRepository } from '../repository/order.repository';
import { PaymentStatus } from '../interfaces/stripe-metadata.interface';
import { User } from '../../user/entities/user.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../../shared/services/interfaces/calendar-event.interface';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AnalyticsService.name);
  }

  /**
   * Get top customers by revenue for dashboard analytics
   */
  async getTopCustomers(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    limit: number,
  ): Promise<
    Array<{
      customerId: number;
      customerName: string;
      email: string;
      totalRevenue: number;
      orderCount: number;
    }>
  > {
    this.logger.log(
      ctx,
      `Getting top ${limit} customers for date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`,
    );

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.createdAt >= :startDate', {
        startDate: dateRange.startDate,
      })
      .andWhere('o.createdAt <= :endDate', { endDate: dateRange.endDate })
      .andWhere("o.stripe_meta->>'paymentStatus' = :status", {
        status: PaymentStatus.SUCCEEDED,
      })
      .getMany();

    // Calculate revenue per customer
    const customerRevenue = new Map<
      number,
      { customer: User; totalRevenue: number; orderCount: number }
    >();

    for (const order of orders) {
      const totalRevenue = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      if (customerRevenue.has(order.customer.id)) {
        const existing = customerRevenue.get(order.customer.id)!;
        existing.totalRevenue += totalRevenue;
        existing.orderCount += 1;
      } else {
        customerRevenue.set(order.customer.id, {
          customer: order.customer,
          totalRevenue,
          orderCount: 1,
        });
      }
    }

    // Sort by revenue and return top customers
    return [...customerRevenue.values()]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map(({ customer, totalRevenue, orderCount }) => ({
        customerId: customer.id,
        customerName: customer.name,
        email: customer.email,
        totalRevenue,
        orderCount,
      }));
  }

  /**
   * Get revenue data for dashboard analytics
   */
  async getRevenueData(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ): Promise<{
    totalRevenue: number;
    periodRevenue: Array<{ date: string; revenue: number }>;
  }> {
    this.logger.log(
      ctx,
      `Getting revenue data for period: ${period}, date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`,
    );

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :startDate', {
        startDate: dateRange.startDate,
      })
      .andWhere('o.createdAt <= :endDate', { endDate: dateRange.endDate })
      .andWhere("o.stripe_meta->>'paymentStatus' = :status", {
        status: PaymentStatus.SUCCEEDED,
      })
      .getMany();

    const revenueData = new Map<string, number>();
    let totalRevenue = 0;

    for (const order of orders) {
      const orderRevenue = order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      totalRevenue += orderRevenue;

      let periodKey: string;
      if (period === 'day') {
        periodKey = order.createdAt.toISOString().split('T')[0];
      } else if (period === 'month') {
        periodKey = order.createdAt.toISOString().slice(0, 7);
      } else {
        periodKey = order.createdAt.toISOString().slice(0, 4);
      }

      revenueData.set(
        periodKey,
        (revenueData.get(periodKey) || 0) + orderRevenue,
      );
    }

    return {
      totalRevenue,
      periodRevenue: [...revenueData.entries()].map(([date, revenue]) => ({
        date,
        revenue,
      })),
    };
  }

  /**
   * Get appointments data for dashboard analytics
   */
  async getAppointmentsData(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ): Promise<{
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
    periodAppointments: Array<{ date: string; count: number }>;
  }> {
    this.logger.log(
      ctx,
      `Getting appointments data for period: ${period}, date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`,
    );

    const orders = await this.getOrdersInDateRange(dateRange);
    const appointmentsData = new Map<string, number>();
    let totalAppointments = 0;
    let upcomingAppointments = 0;
    let completedAppointments = 0;

    for (const order of orders) {
      const orderAppointments = this.calculateOrderAppointments(order);
      totalAppointments += orderAppointments;

      const { upcoming, completed } = this.categorizeAppointments(order);
      upcomingAppointments += upcoming;
      completedAppointments += completed;

      const periodKey = this.getPeriodKey(order.createdAt, period);
      appointmentsData.set(
        periodKey,
        (appointmentsData.get(periodKey) || 0) + orderAppointments,
      );
    }

    return {
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      periodAppointments: [...appointmentsData.entries()].map(
        ([date, count]) => ({
          date,
          count,
        }),
      ),
    };
  }

  /**
   * Get orders within the specified date range
   */
  private async getOrdersInDateRange(dateRange: {
    startDate: Date;
    endDate: Date;
  }): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :startDate', {
        startDate: dateRange.startDate,
      })
      .andWhere('o.createdAt <= :endDate', { endDate: dateRange.endDate })
      .andWhere("o.stripe_meta->>'paymentStatus' = :status", {
        status: PaymentStatus.SUCCEEDED,
      })
      .getMany();
  }

  /**
   * Calculate total appointments for an order
   */
  private calculateOrderAppointments(order: Order): number {
    return order.items.reduce(
      (sum: number, item: OrderItem) => sum + (item.DateTime?.length || 0),
      0,
    );
  }

  /**
   * Categorize appointments as upcoming or completed
   */
  private categorizeAppointments(order: Order): {
    upcoming: number;
    completed: number;
  } {
    let upcoming = 0;
    let completed = 0;
    const now = new Date();

    for (const item of order.items) {
      if (!item.DateTime?.length) {
        continue;
      }

      for (const dateTime of item.DateTime) {
        const appointmentDate = new Date(dateTime);
        if (appointmentDate > now) {
          upcoming++;
        } else {
          completed++;
        }
      }
    }

    return { upcoming, completed };
  }

  /**
   * Generate period key based on period type
   */
  private getPeriodKey(date: Date, period: string): string {
    const isoString = date.toISOString();

    switch (period) {
      case 'day': {
        return isoString.split('T')[0];
      }
      case 'month': {
        return isoString.slice(0, 7);
      }
      default: {
        return isoString.slice(0, 4);
      }
    }
  }
}
