import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../logger/logger.service';
import { RequestContext } from '../../request-context/request-context.dto';
import { SlotAvailabilityService } from './slot-availability.service';
import { SlotReservationService } from './slot-reservation.service';
import { Slot } from '../interfaces/slot.interface';
import { ReservationValidationResult } from '../interfaces/slot-reservation.interface';

@Injectable()
export class SlotService {
  constructor(
    private readonly logger: AppLogger,
    private readonly slotAvailabilityService: SlotAvailabilityService,
    private readonly slotReservationService: SlotReservationService,
  ) {
    this.logger.setContext(SlotService.name);
  }

  /**
   * Main method: Get available slots for a package on a date
   * @param date The date string (ISO format)
   * @param packageId The package/service ID
   * @param gracePeriodHours Grace period in hours (default 24)
   * @returns Slot object with available and booked slots
   */
  async getSlotsForPackage(
    date: string,
    packageId: number,
    gracePeriodHours = 24,
  ): Promise<Slot> {
    const ctx = new RequestContext();
    this.logger.log(
      ctx,
      `Getting slots for package ${packageId} on date ${date}`,
    );

    return this.slotAvailabilityService.getSlotsForPackage(
      ctx,
      date,
      packageId,
      gracePeriodHours,
    );
  }

  /**
   * Reserve slots for an entity (order/task/appointment)
   * @param entityId The entity ID
   * @param entityType The type of entity ('order', 'task', 'appointment')
   * @param slots Array of slot times
   * @param employeeIds Array of employee IDs (one per slot)
   * @param timeoutMinutes Reservation timeout in minutes (default 30)
   * @returns Validation result
   */
  async reserveSlots(
    entityId: number,
    entityType: 'order' | 'task' | 'appointment',
    slots: string[],
    employeeIds: number[],
    timeoutMinutes = 30,
  ): Promise<ReservationValidationResult> {
    const ctx = new RequestContext();
    this.logger.log(
      ctx,
      `Reserving ${slots.length} slots for ${entityType} ${entityId}`,
    );

    // Create items array for validation (assuming single service for now)
    const items = [
      {
        id: 1, // TODO: Get actual service ID
        DateTime: slots,
        assignedEmployeeIds: employeeIds,
      },
    ];

    return this.slotReservationService.validateAndReserveSlots(
      ctx,
      entityId,
      entityType,
      items,
      timeoutMinutes,
    );
  }

  /**
   * Validate slot is still available before finalizing
   * @param slot The slot time to validate
   * @param employeeId The employee ID
   * @param packageId The package ID
   * @returns true if slot is still available
   */
  async validateSlotStillAvailable(
    slot: string,
    employeeId: number,
    packageId: number,
  ): Promise<boolean> {
    const ctx = new RequestContext();
    this.logger.log(
      ctx,
      `Validating slot ${slot} for employee ${employeeId} and package ${packageId}`,
    );

    return this.slotAvailabilityService.isSlotAvailable(
      ctx,
      slot,
      employeeId,
      packageId,
    );
  }

  /**
   * Get database reservations for a date range
   * @param from Start date
   * @param to End date
   * @param serviceId Service ID
   * @returns Map of slot reservations
   */
  async getDatabaseReservations(from: Date, to: Date, serviceId: number) {
    const ctx = new RequestContext();
    return this.slotReservationService.getDatabaseReservations(
      ctx,
      from,
      to,
      serviceId,
    );
  }
}
