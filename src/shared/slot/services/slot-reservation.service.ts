import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '../../logger/logger.service';
import { RequestContext } from '../../request-context/request-context.dto';
import { Order } from '../../../order/entities/order.entity';
import { SlotReservationStatus } from '../constants/slot-reservation-status.constant';
import {
  SlotReservationMap,
  ReservationValidationResult,
} from '../interfaces/slot-reservation.interface';

@Injectable()
export class SlotReservationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(SlotReservationService.name);
  }

  /**
   * Validate if slot is available (not reserved/confirmed)
   * @param ctx Request context
   * @param slot The slot datetime to check
   * @param serviceId The service ID
   * @param employeeId The employee ID
   * @returns true if available, false if not
   */
  async validateSlotAvailability(
    ctx: RequestContext,
    slot: string,
    serviceId: number,
    employeeId: number,
  ): Promise<boolean> {
    try {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Validating slot availability: ${slot} for service ${serviceId} and employee ${employeeId}`,
      );

      // Check for confirmed bookings using TypeORM with JSON queries
      const confirmedBookings = await this.orderRepository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status = :status', {
          status: SlotReservationStatus.CONFIRMED,
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'DateTime' LIKE :dateTime AND json_array_length(item->'assignedEmployeeIds') > 0 AND EXISTS (SELECT 1 FROM json_array_elements(item->'assignedEmployeeIds') as empId WHERE empId::text = :employeeId))",
          {
            dateTime: `%${slot}%`,
            employeeId: employeeId.toString(),
          },
        )
        .getCount();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Confirmed bookings count: ${confirmedBookings}`,
      );

      if (confirmedBookings > 0) {
        this.logger.warn(
          ctx,
          `Slot ${slot} is already confirmed (booked) for employee ${employeeId}`,
        );
        return false;
      }

      // Check for active reservations using TypeORM with JSON queries
      const activeReservations = await this.orderRepository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status = :status', {
          status: SlotReservationStatus.RESERVED,
        })
        .andWhere('o.slot_reservation_expires_at > :now', {
          now: new Date(),
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'DateTime' LIKE :dateTime AND json_array_length(item->'assignedEmployeeIds') > 0 AND EXISTS (SELECT 1 FROM json_array_elements(item->'assignedEmployeeIds') as empId WHERE empId::text = :employeeId))",
          {
            dateTime: `%${slot}%`,
            employeeId: employeeId.toString(),
          },
        )
        .getCount();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Active reservations count: ${activeReservations}`,
      );

      if (activeReservations > 0) {
        this.logger.warn(
          ctx,
          `Slot ${slot} is currently reserved by another customer for employee ${employeeId}`,
        );
        return false;
      }

      this.logger.log(
        ctx,
        `Slot ${slot} is available for employee ${employeeId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error validating slot availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Get database reservations for a specific date range and service
   * @param ctx Request context
   * @param from Start date
   * @param to End date
   * @param serviceId Service ID
   * @returns Map of slot times to reservation data
   */
  async getDatabaseReservations(
    ctx: RequestContext,
    from: Date,
    to: Date,
    serviceId: number,
  ): Promise<SlotReservationMap> {
    try {
      this.logger.log(
        ctx,
        `Getting database reservations for service ${serviceId} from ${from.toISOString()} to ${to.toISOString()}`,
      );

      // Query orders with confirmed or active reservations using proper JSON queries
      const reservations = await this.orderRepository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status IN (:...statuses)', {
          statuses: [
            SlotReservationStatus.CONFIRMED,
            SlotReservationStatus.RESERVED,
          ],
        })
        .andWhere('o.slot_reservation_expires_at > :now', {
          now: new Date(),
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'id' = :serviceId)",
          {
            serviceId: serviceId.toString(),
          },
        )
        .getMany();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Found ${reservations.length} orders with reservations for service ${serviceId}`,
      );

      // eslint-disable-next-line unicorn/no-array-for-each
      reservations.forEach((order, index) => {
        this.logger.log(
          ctx,
          `🔍 DEBUG Reservation ${index + 1}: Order ID=${order.id}, Status=${order.slot_reservation_status}, Expires=${order.slot_reservation_expires_at}, Items=${JSON.stringify(order.items)}`,
        );
      });

      const reservationMap: SlotReservationMap = {};

      for (const order of reservations) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (
              item.id === serviceId &&
              item.DateTime &&
              Array.isArray(item.DateTime)
            ) {
              for (let i = 0; i < item.DateTime!.length; i++) {
                const dateTime = item.DateTime![i];
                const slotTime = new Date(dateTime);

                if (slotTime >= from && slotTime <= to) {
                  const slotKey = slotTime.toISOString();

                  if (!reservationMap[slotKey]) {
                    reservationMap[slotKey] = [];
                  }

                  reservationMap[slotKey].push({
                    // eslint-disable-next-line security/detect-object-injection
                    employeeId: item.assignedEmployeeIds![i] || 0,
                    status: order.slot_reservation_status || 'UNKNOWN',
                    expiresAt: order.slot_reservation_expires_at,
                  });
                }
              }
            }
          }
        }
      }

      this.logger.log(
        ctx,
        `Found ${reservations.length} database reservations affecting ${Object.keys(reservationMap).length} slots`,
      );

      return reservationMap;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error getting database reservations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {};
    }
  }

  /**
   * Validate and reserve slots for an entity (order/task/appointment)
   * @param ctx Request context
   * @param entityId The entity ID (order ID, task ID, etc.)
   * @param entityType The type of entity ('order', 'task', 'appointment')
   * @param items Array of items with slots and assigned employees
   * @param timeoutMinutes Reservation timeout in minutes
   * @returns Validation result
   */
  async validateAndReserveSlots(
    ctx: RequestContext,
    entityId: number,
    entityType: string,
    items: Array<{
      id: number;
      DateTime: string[];
      assignedEmployeeIds: number[];
    }>,
    timeoutMinutes = 30,
  ): Promise<ReservationValidationResult> {
    this.logger.log(ctx, 'Starting slot validation and reservation process');

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    this.logger.log(
      ctx,
      `Entity will reserve slots until: ${expiresAt.toISOString()} (${timeoutMinutes} minutes)`,
    );

    const conflictingSlots: string[] = [];

    // Validate each item's slots
    for (const item of items) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Processing item ${item.id} with assignedEmployeeIds: ${item.assignedEmployeeIds}`,
      );

      if (
        item.DateTime &&
        item.DateTime.length > 0 &&
        item.assignedEmployeeIds &&
        item.assignedEmployeeIds.length > 0
      ) {
        for (let i = 0; i < item.DateTime.length; i++) {
          const dateTime = item.DateTime[i];
          const employeeId = item.assignedEmployeeIds![i];
          this.logger.log(
            ctx,
            `🔍 DEBUG: Validating slot ${dateTime} for item ${item.id} with employee ${employeeId}`,
          );

          const isAvailable = await this.validateSlotAvailability(
            ctx,
            dateTime,
            item.id,
            employeeId,
          );

          if (!isAvailable) {
            conflictingSlots.push(dateTime);
          }
        }
      }
    }

    if (conflictingSlots.length > 0) {
      return {
        isValid: false,
        conflictingSlots,
        errorMessage: `Slots ${conflictingSlots.join(', ')} are no longer available`,
      };
    }

    this.logger.log(
      ctx,
      'All slots validated successfully - reservation can be created',
    );

    return {
      isValid: true,
    };
  }
}
