import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { OrderRepository } from '../repository/order.repository';
import { PaymentStatus } from '../interfaces/stripe-metadata.interface';
import { User } from '../../user/entities/user.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../../shared/services/interfaces/calendar-event.interface';
import { Invoice } from '../../invoicing/entities/invoice.entity';
import { InvoiceStatus } from '../../invoicing/constants/invoice-status.constant';
import { StripeService } from '../../shared/services/stripe.service';
import { Refund } from '../../finance/entities/refund.entity';
import { RefundStatus } from '../../finance/constants/finance.constant';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly orderRepository: OrderRepository,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    private readonly stripeService: StripeService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AnalyticsService.name);
  }

  /**
   * Get top customers by revenue for dashboard analytics
   */
  async getTopCustomers(
    ctx: RequestContext,
    dateRange: { startDate: Date | string; endDate: Date | string },
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
    // Ensure we have Date objects
    const startDate =
      typeof dateRange.startDate === 'string'
        ? new Date(dateRange.startDate)
        : dateRange.startDate;
    const endDate =
      typeof dateRange.endDate === 'string'
        ? new Date(dateRange.endDate)
        : dateRange.endDate;

    this.logger.log(
      ctx,
      `Getting top ${limit} customers for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.createdAt >= :startDate', {
        startDate,
      })
      .andWhere('o.createdAt <= :endDate', { endDate })
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
    dateRange: { startDate: Date | string; endDate: Date | string },
    period: string,
  ): Promise<{
    totalRevenue: number;
    periodRevenue: Array<{ date: string; revenue: number }>;
  }> {
    // Ensure we have Date objects
    const startDate =
      typeof dateRange.startDate === 'string'
        ? new Date(dateRange.startDate)
        : dateRange.startDate;
    const endDate =
      typeof dateRange.endDate === 'string'
        ? new Date(dateRange.endDate)
        : dateRange.endDate;

    this.logger.log(
      ctx,
      `Getting revenue data for period: ${period}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const orders = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :startDate', {
        startDate,
      })
      .andWhere('o.createdAt <= :endDate', { endDate })
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

      // Ensure createdAt is a Date object
      const createdAt =
        typeof order.createdAt === 'string'
          ? new Date(order.createdAt)
          : order.createdAt;

      let periodKey: string;
      const normalizedPeriod = period.toLowerCase();
      if (normalizedPeriod === 'day') {
        periodKey = createdAt.toISOString().split('T')[0];
      } else if (normalizedPeriod === 'week') {
        // Get year and week number (ISO 8601 week)
        const weekStart = new Date(createdAt);
        weekStart.setDate(createdAt.getDate() - createdAt.getDay());
        periodKey = weekStart.toISOString().slice(0, 10);
      } else if (normalizedPeriod === 'month') {
        periodKey = createdAt.toISOString().slice(0, 7);
      } else if (normalizedPeriod === 'quarter') {
        const quarter = Math.floor(createdAt.getMonth() / 3) + 1;
        periodKey = `${createdAt.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = createdAt.toISOString().slice(0, 4);
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
    dateRange: { startDate: Date | string; endDate: Date | string },
    period: string,
  ): Promise<{
    totalAppointments: number;
    upcomingAppointments: number;
    completedAppointments: number;
    periodAppointments: Array<{ date: string; count: number }>;
  }> {
    // Ensure we have Date objects
    const startDate =
      typeof dateRange.startDate === 'string'
        ? new Date(dateRange.startDate)
        : dateRange.startDate;
    const endDate =
      typeof dateRange.endDate === 'string'
        ? new Date(dateRange.endDate)
        : dateRange.endDate;

    this.logger.log(
      ctx,
      `Getting appointments data for period: ${period}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const orders = await this.getOrdersInDateRange({ startDate, endDate });
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
    startDate: Date | string;
    endDate: Date | string;
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
        const appointmentDate =
          typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
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
  private getPeriodKey(date: Date | string, period: string): string {
    // Ensure we have a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const isoString = dateObj.toISOString();
    const normalizedPeriod = period.toLowerCase();

    switch (normalizedPeriod) {
      case 'day': {
        return isoString.split('T')[0];
      }
      case 'week': {
        // Get year and week number (ISO 8601 week)
        const weekStart = new Date(dateObj);
        weekStart.setDate(dateObj.getDate() - dateObj.getDay());
        return weekStart.toISOString().slice(0, 10);
      }
      case 'month': {
        return isoString.slice(0, 7);
      }
      case 'quarter': {
        const quarter = Math.floor(dateObj.getMonth() / 3) + 1;
        return `${dateObj.getFullYear()}-Q${quarter}`;
      }
      default: {
        return isoString.slice(0, 4);
      }
    }
  }

  /**
   * Get tax collection data for dashboard analytics
   * Retrieves paid invoices and converts tax to current CAD values
   */
  async getTaxCollectionData(
    ctx: RequestContext,
    dateRange: { startDate: Date | string; endDate: Date | string },
    period: string,
  ): Promise<{
    totalTaxCollected: number;
    totalTaxHistorical: number;
    periodTaxCollection: Array<{
      date: string;
      taxCollected: number;
      taxCollectedHistorical: number;
    }>;
  }> {
    // Ensure we have Date objects
    const startDate =
      typeof dateRange.startDate === 'string'
        ? new Date(dateRange.startDate)
        : dateRange.startDate;
    const endDate =
      typeof dateRange.endDate === 'string'
        ? new Date(dateRange.endDate)
        : dateRange.endDate;

    this.logger.log(
      ctx,
      `Getting tax collection data for period: ${period}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Get paid invoices within date range
    const invoices = await this.invoiceRepository.find({
      where: {
        status: InvoiceStatus.PAID,
        paidDate: MoreThanOrEqual(startDate),
      },
    });

    // Filter by endDate manually since we need to check paidDate
    const filteredInvoices = invoices.filter(
      (invoice) => invoice.paidDate && new Date(invoice.paidDate) <= endDate,
    );

    const periodTaxData = new Map<
      string,
      { current: number; historical: number }
    >();
    let totalTaxCollected = 0;
    let totalTaxHistorical = 0;

    for (const invoice of filteredInvoices) {
      // All invoices are always stored in CAD
      const taxInCad = Number(invoice.tax) / 100; // Convert from cents to dollars
      totalTaxHistorical += taxInCad;
      totalTaxCollected += taxInCad; // No conversion needed - always in CAD

      // Get period key based on paid date
      if (!invoice.paidDate) {
        continue; // Skip invoices with undefined paidDate
      }
      const periodKey = this.getPeriodKey(invoice.paidDate, period);

      // Aggregate by period
      const existing = periodTaxData.get(periodKey) || {
        current: 0,
        historical: 0,
      };
      periodTaxData.set(periodKey, {
        current: existing.current + taxInCad,
        historical: existing.historical + taxInCad,
      });
    }

    return {
      totalTaxCollected,
      totalTaxHistorical,
      periodTaxCollection: [...periodTaxData.entries()].map(
        ([date, amounts]) => ({
          date,
          taxCollected: amounts.current,
          taxCollectedHistorical: amounts.historical,
        }),
      ),
    };
  }

  /**
   * Get refund data for dashboard analytics
   */
  async getRefundData(
    ctx: RequestContext,
    dateRange: { startDate: Date | string; endDate: Date | string },
    period: string,
  ): Promise<{
    totalRefunds: number;
    totalRefundCount: number;
    periodRefunds: Array<{
      date: string;
      refundAmount: number;
      refundCount: number;
    }>;
  }> {
    // Ensure we have Date objects
    const startDate =
      typeof dateRange.startDate === 'string'
        ? new Date(dateRange.startDate)
        : dateRange.startDate;
    const endDate =
      typeof dateRange.endDate === 'string'
        ? new Date(dateRange.endDate)
        : dateRange.endDate;

    this.logger.log(
      ctx,
      `Getting refund data for period: ${period}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Get completed refunds within date range (based on refundedAt date)
    const refunds = await this.refundRepository.find({
      where: {
        status: RefundStatus.COMPLETED,
        refundedAt: MoreThanOrEqual(startDate),
      },
    });

    // Filter by endDate manually since we need to check refundedAt
    const filteredRefunds = refunds.filter(
      (refund) =>
        refund.refundedAt &&
        new Date(refund.refundedAt) <= endDate &&
        new Date(refund.refundedAt) >= startDate,
    );

    const periodRefundData = new Map<
      string,
      { amount: number; count: number }
    >();
    let totalRefunds = 0;
    let totalRefundCount = 0;

    for (const refund of filteredRefunds) {
      // Calculate refund amount in CAD
      // If metadata has refundAmountInCad, use it (already in CAD cents)
      // Otherwise, check if the refund is already in CAD
      let refundAmountInCad = 0;

      if (refund.metadata?.refundAmountInCad) {
        // Metadata has the CAD amount in cents
        refundAmountInCad = Number(refund.metadata.refundAmountInCad) / 100;
      } else if (refund.currency?.toUpperCase() === 'CAD') {
        // Refund is already in CAD, convert from cents to dollars
        refundAmountInCad = Number(refund.amount) / 100;
      } else {
        // Refund is in a different currency - we need to convert it
        // Try to get exchange rate from Stripe
        try {
          const rates = await this.stripeService.getExchangeRates(ctx, 'CAD');
          const conversionRate =
            rates.rates[refund.currency?.toUpperCase() || 'USD'];

          if (conversionRate) {
            // Convert foreign currency to CAD
            const amountInForeignCurrency = Number(refund.amount) / 100; // Convert from cents
            refundAmountInCad = amountInForeignCurrency / conversionRate;
          } else {
            this.logger.warn(
              ctx,
              `Could not find exchange rate for ${refund.currency}, using amount as-is`,
            );
            // Fall back to using the amount as if it were CAD (not ideal, but better than 0)
            refundAmountInCad = Number(refund.amount) / 100;
          }
        } catch (error) {
          this.logger.warn(
            ctx,
            `Failed to convert refund amount: ${error instanceof Error ? error.message : 'Unknown error'}, using amount as-is`,
          );
          // Fall back to using the amount as if it were CAD
          refundAmountInCad = Number(refund.amount) / 100;
        }
      }

      totalRefunds += refundAmountInCad;
      totalRefundCount += 1;

      // Get period key based on refundedAt date
      if (!refund.refundedAt) {
        continue; // Skip refunds with undefined refundedAt
      }
      const periodKey = this.getPeriodKey(refund.refundedAt, period);

      // Aggregate by period
      const existing = periodRefundData.get(periodKey) || {
        amount: 0,
        count: 0,
      };
      periodRefundData.set(periodKey, {
        amount: existing.amount + refundAmountInCad,
        count: existing.count + 1,
      });
    }

    return {
      totalRefunds,
      totalRefundCount,
      periodRefunds: [...periodRefundData.entries()].map(([date, data]) => ({
        date,
        refundAmount: data.amount,
        refundCount: data.count,
      })),
    };
  }
}
