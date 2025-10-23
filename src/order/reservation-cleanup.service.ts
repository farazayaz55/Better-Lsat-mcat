import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { OrderRepository } from './repository/order.repository';
import { SlotReservationStatus } from '../shared/slot/constants/slot-reservation-status.constant';

@Injectable()
export class ReservationCleanupService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(ReservationCleanupService.name);
  }

  /**
   * Runs every 5 minutes to clean up expired reservations
   * This is the main cron job that automatically expires old reservations
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupExpiredReservations(): Promise<void> {
    const ctx = new RequestContext();
    ctx.requestID = 'cleanup-cron-job';
    ctx.user = null; // System job, no user context

    this.logger.log(ctx, '🔄 Starting automatic reservation cleanup job');

    try {
      const expiredCount = await this.expireOldReservations(ctx);
      this.logger.log(
        ctx,
        `✅ Cleanup job completed. Expired ${expiredCount} reservations.`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `❌ Cleanup job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Runs every hour to log reservation statistics
   * This provides monitoring and insights into reservation patterns
   */
  @Cron(CronExpression.EVERY_HOUR)
  async logReservationStats(): Promise<void> {
    const ctx = new RequestContext();
    ctx.requestID = 'stats-cron-job';
    ctx.user = null; // System job, no user context

    try {
      const stats = await this.getReservationStats(ctx);
      this.logger.log(
        ctx,
        `📊 Reservation Stats - Total: ${stats.total}, Reserved: ${stats.reserved}, Confirmed: ${stats.confirmed}, Expired: ${stats.expired}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `❌ Stats logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Expire old reservations (used by cron job)
   * @param ctx Request context
   * @returns Number of reservations expired
   */
  async expireOldReservations(ctx: RequestContext): Promise<number> {
    try {
      this.logger.log(ctx, 'Expiring old reservations...');

      // Find orders with expired reservations
      const expiredOrders = await this.orderRepository
        .createQueryBuilder('order')
        .where('order.slot_reservation_status = :status', {
          status: SlotReservationStatus.RESERVED,
        })
        .andWhere('order.slot_reservation_expires_at < :now', {
          now: new Date(),
        })
        .getMany();

      if (expiredOrders.length === 0) {
        this.logger.log(ctx, 'No expired reservations found');
        return 0;
      }

      // Update expired orders
      const orderIds = expiredOrders.map((order) => order.id);
      await this.orderRepository
        .createQueryBuilder()
        .update()
        .set({ slot_reservation_status: SlotReservationStatus.EXPIRED })
        .where('id IN (:...ids)', { ids: orderIds })
        .execute();

      this.logger.log(
        ctx,
        `Expired ${expiredOrders.length} reservations for orders: ${orderIds.join(', ')}`,
      );

      // Log details for each expired order
      for (const order of expiredOrders) {
        this.logger.log(
          ctx,
          `Order ${order.id} reservation expired at ${order.slot_reservation_expires_at?.toISOString()}`,
        );
      }

      return expiredOrders.length;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error expiring old reservations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get statistics about current reservations
   * @param ctx Request context
   * @returns Reservation statistics
   */
  async getReservationStats(ctx: RequestContext): Promise<{
    total: number;
    reserved: number;
    confirmed: number;
    expired: number;
  }> {
    try {
      const stats = await this.orderRepository
        .createQueryBuilder('o')
        .select('o.slot_reservation_status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('o.slot_reservation_status IS NOT NULL')
        .groupBy('o.slot_reservation_status')
        .getRawMany();

      const result = {
        total: 0,
        reserved: 0,
        confirmed: 0,
        expired: 0,
      };

      for (const stat of stats) {
        const count = parseInt(stat.count, 10);
        result.total += count;

        switch (stat.status) {
          case 'RESERVED': {
            result.reserved = count;
            break;
          }
          case 'CONFIRMED': {
            result.confirmed = count;
            break;
          }
          case 'EXPIRED': {
            result.expired = count;
            break;
          }
        }
      }

      this.logger.log(ctx, `Reservation stats: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error getting reservation stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Run cleanup job manually (for testing/debugging purposes)
   * The actual cleanup runs automatically via cron job every 5 minutes
   * @param ctx Request context
   * @returns Cleanup results
   */
  async runCleanupJob(ctx: RequestContext): Promise<{
    expiredCount: number;
    stats: {
      total: number;
      reserved: number;
      confirmed: number;
      expired: number;
    };
  }> {
    this.logger.log(ctx, 'Starting manual reservation cleanup job');

    try {
      const expiredCount = await this.expireOldReservations(ctx);
      const stats = await this.getReservationStats(ctx);

      this.logger.log(
        ctx,
        `Cleanup job completed. Expired ${expiredCount} reservations.`,
      );

      return { expiredCount, stats };
    } catch (error) {
      this.logger.error(
        ctx,
        `Cleanup job failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
