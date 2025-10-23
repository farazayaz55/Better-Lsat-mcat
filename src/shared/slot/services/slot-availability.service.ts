import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../logger/logger.service';
import { RequestContext } from '../../request-context/request-context.dto';
import { GoogleCalendarBookingService } from '../../services/google-calendar/google-calendar-booking.service';
import { UserService } from '../../../user/services/user.service';
import { User } from '../../../user/entities/user.entity';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { SlotGeneratorService } from './slot-generator.service';
import { SlotReservationService } from './slot-reservation.service';
import { AvailableSlot } from '../interfaces/available-slot.interface';
import { Slot } from '../interfaces/slot.interface';

@Injectable()
export class SlotAvailabilityService {
  constructor(
    private readonly logger: AppLogger,
    private readonly googleCalendarBookingService: GoogleCalendarBookingService,
    private readonly userService: UserService,
    private readonly employeeAvailabilityService: EmployeeAvailabilityService,
    private readonly slotGeneratorService: SlotGeneratorService,
    private readonly slotReservationService: SlotReservationService,
  ) {
    this.logger.setContext(SlotAvailabilityService.name);
  }

  /**
   * Get available slots for a package on a specific date
   * @param ctx Request context
   * @param date The date to check slots for
   * @param packageId The package/service ID
   * @param gracePeriodHours Grace period in hours (default 24)
   * @returns Slot object with available and booked slots
   */
  async getSlotsForPackage(
    ctx: RequestContext,
    date: string,
    packageId: number,
    gracePeriodHours = 24,
  ): Promise<Slot> {
    const dateObj = new Date(date);
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth() + 1;
    const day = dateObj.getUTCDate();

    this.logger.log(
      ctx,
      `🔍 DEBUG: Parsed date - Input: ${date}, Parsed: ${year}-${month}-${day}, Day of week: ${this.employeeAvailabilityService.getDayOfWeekName(dateObj.getDay())}`,
    );

    // Validate that the requested date is not in the past
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    this.logger.log(
      ctx,
      `🔍 DEBUG: Date validation - Requested: ${dateObj.toISOString()}, Today: ${today.toISOString()}, Is past: ${dateObj < today}`,
    );

    if (dateObj < today) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Date is in the past, returning empty slots`,
      );

      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes: 60, // Default duration
        warning: 'Cannot book slots for dates in the past',
      };
    }

    const from = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const to = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Get product duration (assuming we have a product service)
    // For now, default to 60 minutes - this should be injected from ProductService
    const slotDurationMinutes = 60; // TODO: Get from ProductService

    // Calculate grace period cutoff time
    const now = new Date();
    const gracePeriodCutoff = new Date(
      now.getTime() + gracePeriodHours * 60 * 60 * 1000,
    );

    this.logger.log(
      ctx,
      `🔍 DEBUG: Grace period - Now: ${now.toISOString()}, Cutoff: ${gracePeriodCutoff.toISOString()}, Hours: ${gracePeriodHours}`,
    );

    // Get all employees who can work on this service
    const availableEmployees = await this.userService.findEmployeesByServiceId(
      packageId,
      ctx,
    );

    this.logger.log(
      ctx,
      `🔍 DEBUG: Found ${availableEmployees.length} employees for service ${packageId}`,
    );

    if (availableEmployees.length === 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: No employees found for service ${packageId}`,
      );
      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes,
        warning: `No employees available for service ID: ${packageId}`,
      };
    }

    // Generate time slots
    const generatedSlots = this.slotGeneratorService.generateTimeSlots(
      dateObj,
      slotDurationMinutes,
      ctx,
    );

    // Handle package ID 8 (GHL integration) - special case
    if (packageId === 8) {
      return this.handleGhlPackage(
        ctx,
        from,
        to,
        generatedSlots,
        availableEmployees,
        gracePeriodCutoff,
        slotDurationMinutes,
      );
    }

    // For other packages, use Google Calendar integration + database reservations
    return this.handleRegularPackage(
      ctx,
      from,
      to,
      generatedSlots,
      availableEmployees,
      packageId,
      gracePeriodCutoff,
      slotDurationMinutes,
    );
  }

  /**
   * Handle GHL package (package ID 8) - special integration
   */
  private async handleGhlPackage(
    ctx: RequestContext,
    from: Date,
    to: Date,
    generatedSlots: string[],
    availableEmployees: User[],
    gracePeriodCutoff: Date,
    slotDurationMinutes: number,
  ): Promise<Slot> {
    try {
      // Get GHL slots (assuming GhlService exists)
      // const ghlSlots = await this.ghlService.getSlots(
      //   from.getTime().toString(),
      //   to.getTime().toString(),
      // );

      // For now, use generated slots as fallback
      const ghlSlots = generatedSlots;

      const googleCalendarBookings =
        await this.googleCalendarBookingService.getBookedSlots(
          from,
          to,
          availableEmployees,
        );

      const availableSlots = ghlSlots
        .filter(
          (slot) =>
            !this.slotGeneratorService.isSlotWithinGracePeriod(
              slot,
              gracePeriodCutoff,
            ),
        )
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Find employees available for this slot (working hours + not busy)
          const availableForSlot = availableEmployees.filter(
            (emp) =>
              !busyEmployeeIds.includes(emp.id) &&
              this.employeeAvailabilityService.isEmployeeAvailableAtTime(
                emp,
                slot,
              ),
          );

          return {
            slot,
            availableEmployees: availableForSlot.map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
            })),
          };
        })
        .filter((slotInfo) => slotInfo.availableEmployees.length > 0);

      return {
        bookedSlots: [],
        availableSlots,
        slotDurationMinutes,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to get GHL slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback to regular package handling
      return this.handleRegularPackage(
        ctx,
        from,
        to,
        generatedSlots,
        availableEmployees,
        8,
        gracePeriodCutoff,
        slotDurationMinutes,
      );
    }
  }

  /**
   * Handle regular packages with Google Calendar + database integration
   */
  private async handleRegularPackage(
    ctx: RequestContext,
    from: Date,
    to: Date,
    generatedSlots: string[],
    availableEmployees: User[],
    packageId: number,
    gracePeriodCutoff: Date,
    slotDurationMinutes: number,
  ): Promise<Slot> {
    try {
      // Get booked slots from Google Calendar
      const googleCalendarBookings =
        await this.googleCalendarBookingService.getBookedSlots(
          from,
          to,
          availableEmployees,
        );

      // Get database reservations
      const databaseReservations =
        await this.slotReservationService.getDatabaseReservations(
          ctx,
          from,
          to,
          packageId,
        );

      // Filter available slots (working hours + availability + grace period)
      this.logger.log(
        ctx,
        `🔍 DEBUG: Starting slot filtering - Generated ${generatedSlots.length} slots, Grace period cutoff: ${gracePeriodCutoff.toISOString()}`,
      );

      const slotsAfterGracePeriod = generatedSlots.filter(
        (slot) =>
          !this.slotGeneratorService.isSlotWithinGracePeriod(
            slot,
            gracePeriodCutoff,
          ),
      );

      this.logger.log(
        ctx,
        `🔍 DEBUG: After grace period filter - ${slotsAfterGracePeriod.length} slots remaining`,
      );

      const availableSlots: AvailableSlot[] = slotsAfterGracePeriod
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Add database reservations to busy employees
          const slotReservations = databaseReservations[slot] || [];
          const reservedEmployeeIds = slotReservations.map((r) => r.employeeId);
          const allBusyEmployeeIds = [
            ...busyEmployeeIds,
            ...reservedEmployeeIds,
          ];

          // Find employees available for this slot (working hours + not busy)
          const availableForSlot = availableEmployees.filter((emp) => {
            const isNotBusy = !allBusyEmployeeIds.includes(emp.id);
            const isAvailableAtTime =
              this.employeeAvailabilityService.isEmployeeAvailableAtTime(
                emp,
                slot,
              );

            // Debug log for first few slots
            if (slotsAfterGracePeriod.indexOf(slot) < 3) {
              this.logger.log(
                ctx,
                `🔍 DEBUG: Employee ${emp.name} (${emp.id}) - Slot ${slot} - Not busy: ${isNotBusy}, Available at time: ${isAvailableAtTime}`,
              );
            }

            return isNotBusy && isAvailableAtTime;
          });

          // Debug log for first few slots to understand filtering
          if (slotsAfterGracePeriod.indexOf(slot) < 3) {
            this.logger.log(
              ctx,
              `🔍 DEBUG: Slot ${slot} - Busy employees: ${allBusyEmployeeIds.length}, Available employees: ${availableForSlot.length}`,
            );
          }

          return {
            slot,
            availableEmployees: availableForSlot.map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
            })),
          };
        })
        .filter((slotInfo) => slotInfo.availableEmployees.length > 0);

      // Find completely booked slots (all employees busy OR outside working hours)
      const bookedSlots = generatedSlots
        .filter(
          (slot) =>
            !this.slotGeneratorService.isSlotWithinGracePeriod(
              slot,
              gracePeriodCutoff,
            ),
        )
        .filter((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);
          const slotReservations = databaseReservations[slot] || [];
          const reservedEmployeeIds = slotReservations.map((r) => r.employeeId);
          const allBusyEmployeeIds = [
            ...busyEmployeeIds,
            ...reservedEmployeeIds,
          ];

          // Check if all employees are either busy or outside working hours
          const employeesInWorkingHours = availableEmployees.filter((emp) =>
            this.employeeAvailabilityService.isEmployeeAvailableAtTime(
              emp,
              slot,
            ),
          );

          const busyEmployeesInWorkingHours = employeesInWorkingHours.filter(
            (emp) => allBusyEmployeeIds.includes(emp.id),
          );

          return (
            busyEmployeesInWorkingHours.length ===
              employeesInWorkingHours.length &&
            employeesInWorkingHours.length > 0
          );
        });

      this.logger.log(
        ctx,
        `Found ${availableSlots.length} available slots and ${bookedSlots.length} booked slots for service ${packageId}`,
      );

      return {
        bookedSlots: bookedSlots.sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime(),
        ),
        availableSlots,
        slotDurationMinutes,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to get Google Calendar slots: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback: return slots filtered by working hours only
      const availableSlots = generatedSlots
        .map((slot) => {
          const availableForSlot = availableEmployees.filter((emp) =>
            this.employeeAvailabilityService.isEmployeeAvailableAtTime(
              emp,
              slot,
            ),
          );

          return {
            slot,
            availableEmployees: availableForSlot.map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
            })),
          };
        })
        .filter((slotInfo) => slotInfo.availableEmployees.length > 0);

      return {
        bookedSlots: [],
        availableSlots,
        slotDurationMinutes,
        warning: 'Unable to check Google Calendar availability',
      };
    }
  }

  /**
   * Check if specific slot is available for employee
   * @param ctx Request context
   * @param slot The slot time to check
   * @param employeeId The employee ID
   * @param packageId The package ID
   * @returns true if slot is available
   */
  async isSlotAvailable(
    ctx: RequestContext,
    slot: string,
    employeeId: number,
    packageId: number,
  ): Promise<boolean> {
    // Check database reservations
    const isDatabaseAvailable =
      await this.slotReservationService.validateSlotAvailability(
        ctx,
        slot,
        packageId,
        employeeId,
      );

    if (!isDatabaseAvailable) {
      return false;
    }

    // Check Google Calendar availability
    const employees = await this.userService.findEmployeesByServiceId(
      packageId,
      ctx,
    );
    const employee = employees.find((emp: User) => emp.id === employeeId);

    if (!employee) {
      return false;
    }

    const availableEmployees =
      await this.googleCalendarBookingService.getAvailableEmployeesAtTime(
        slot,
        [employee],
      );

    return availableEmployees.length > 0;
  }
}
