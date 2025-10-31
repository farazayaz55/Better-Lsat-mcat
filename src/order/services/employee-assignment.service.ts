import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GoogleCalendarBookingService } from '../../shared/services/google-calendar/google-calendar-booking.service';
import { UserService } from '../../user/services/user.service';
import { User } from '../../user/entities/user.entity';
import { SlotService } from '../../shared/slot/services/slot.service';
import { EmployeeAvailabilityService } from '../../shared/slot/services/employee-availability.service';

export interface EmployeeAssignmentResult {
  employee: User;
  assignedSlots: string[];
}

@Injectable()
export class EmployeeAssignmentService {
  constructor(
    private readonly logger: AppLogger,
    private readonly slotService: SlotService,
    private readonly googleCalendarBookingService: GoogleCalendarBookingService,
    private readonly userService: UserService,
    private readonly employeeAvailabilityService: EmployeeAvailabilityService,
  ) {
    this.logger.setContext(EmployeeAssignmentService.name);
  }

  /**
   * Assign employees using round-robin strategy
   * @param ctx Request context
   * @param serviceId The service ID
   * @param slots Array of slot times
   * @returns Assigned employees or undefined if none available
   */
  async assignEmployeeRoundRobin(
    ctx: RequestContext,
    serviceId: number,
    slots: string[],
  ): Promise<EmployeeAssignmentResult[] | undefined> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: assignEmployeeRoundRobin called for serviceId: ${serviceId}, slots: ${JSON.stringify(slots)}`,
    );

    const availableEmployees = await this.getAvailableEmployees(
      ctx,
      serviceId,
      slots,
    );
    if (availableEmployees.length === 0) {
      this.logger.warn(
        ctx,
        `❌ No employees available for service ID: ${serviceId}`,
      );
      return undefined;
    }

    if (!slots?.length) {
      this.logger.log(ctx, `🔍 DEBUG: No specific time slots provided`);
      return undefined;
    }

    try {
      // First try to assign one employee to all slots
      const singleEmployee = await this.assignSingleEmployee(
        ctx,
        slots,
        availableEmployees,
        serviceId,
      );
      if (singleEmployee) {
        return [singleEmployee];
      }

      // If no single employee can handle all slots, assign multiple employees
      return await this.assignMultipleEmployees(
        ctx,
        slots,
        availableEmployees,
        serviceId,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `❌ Failed to assign employees: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get available employees for a service
   */
  private async getAvailableEmployees(
    ctx: RequestContext,
    serviceId: number,
    slots?: string[],
  ): Promise<User[]> {
    const employees = await this.userService.findEmployeesByServiceId(
      serviceId,
      ctx,
    );
    this.logger.log(
      ctx,
      `🔍 DEBUG: Found ${employees.length} employees for service ${serviceId}`,
    );

    if (employees.length > 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Available employees: ${employees.map((emp) => `${emp.name} (ID: ${emp.id}, count: ${emp.lastAssignedOrderCount})`).join(', ')}`,
      );
    }

    // If slots are provided, pre-filter employees by work hours
    if (slots && slots.length > 0) {
      const availableEmployees = employees.filter((employee) => {
        // Check if employee is available for at least one slot
        const isAvailableForAnySlot = slots.some((slot) =>
          this.employeeAvailabilityService.isEmployeeAvailableAtTime(
            employee,
            slot,
          ),
        );

        if (!isAvailableForAnySlot) {
          this.logger.log(
            ctx,
            `🔍 DEBUG: Filtering out employee ${employee.name} (ID: ${employee.id}) - not available for any of the requested slots`,
          );
        }

        return isAvailableForAnySlot;
      });

      this.logger.log(
        ctx,
        `🔍 DEBUG: After work hours filtering: ${availableEmployees.length} employees available for the requested slots`,
      );

      return availableEmployees;
    }

    return employees;
  }

  /**
   * Assign a single employee to handle all slots
   */
  private async assignSingleEmployee(
    ctx: RequestContext,
    slots: string[],
    employees: User[],
    serviceId: number,
  ): Promise<EmployeeAssignmentResult | undefined> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: Looking for one employee who can handle all ${slots.length} slots`,
    );

    const sortedEmployees = this.sortEmployeesByAssignmentCount(employees);
    this.logEmployeeAssignmentOrder(ctx, sortedEmployees);

    for (const employee of sortedEmployees) {
      if (
        await this.canEmployeeHandleAllSlots(ctx, slots, employee, serviceId)
      ) {
        await this.updateAssignmentCount(ctx, employee.id);
        this.logger.log(
          ctx,
          `✅ Assigned employee ${employee.name} (ID: ${employee.id}) for all ${slots.length} slots`,
        );
        return {
          employee,
          assignedSlots: slots,
        };
      }
    }

    this.logger.error(
      ctx,
      `❌ No employee found who can handle all ${slots.length} slots`,
    );
    return undefined;
  }

  /**
   * Assign multiple employees to different slots
   */
  private async assignMultipleEmployees(
    ctx: RequestContext,
    slots: string[],
    employees: User[],
    serviceId: number,
  ): Promise<EmployeeAssignmentResult[]> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: Assigning multiple employees to ${slots.length} slots`,
    );

    const sortedEmployees = this.sortEmployeesByAssignmentCount(employees);
    const assignments: EmployeeAssignmentResult[] = [];
    const employeeSlotCounts = new Map<number, number>();

    for (const slot of slots) {
      const availableEmployee = await this.findEmployeeForSlot(
        ctx,
        slot,
        sortedEmployees,
        serviceId,
      );

      if (availableEmployee) {
        const currentCount = employeeSlotCounts.get(availableEmployee.id) || 0;
        employeeSlotCounts.set(availableEmployee.id, currentCount + 1);

        // Update assignment count
        await this.updateAssignmentCount(ctx, availableEmployee.id);

        // Add to assignments
        const existingAssignment = assignments.find(
          (a) => a.employee.id === availableEmployee.id,
        );
        if (existingAssignment) {
          existingAssignment.assignedSlots.push(slot);
        } else {
          assignments.push({
            employee: availableEmployee,
            assignedSlots: [slot],
          });
        }

        this.logger.log(
          ctx,
          `✅ Assigned employee ${availableEmployee.name} to slot ${slot}`,
        );
      } else {
        this.logger.warn(ctx, `❌ No employee available for slot ${slot}`);
      }
    }

    return assignments;
  }

  /**
   * Sort employees by assignment count for round-robin
   */
  private sortEmployeesByAssignmentCount(employees: User[]): User[] {
    return employees.sort(
      (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
    );
  }

  /**
   * Log employee assignment order
   */
  private logEmployeeAssignmentOrder(
    ctx: RequestContext,
    employees: User[],
  ): void {
    this.logger.log(
      ctx,
      `🔍 DEBUG: Sorted employees by assignment count: ${employees.map((emp) => `${emp.name} (count: ${emp.lastAssignedOrderCount})`).join(', ')}`,
    );
  }

  /**
   * Check if an employee can handle all provided slots
   */
  private async canEmployeeHandleAllSlots(
    ctx: RequestContext,
    slots: string[],
    employee: User,
    serviceId: number,
  ): Promise<boolean> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: Checking if employee ${employee.name} (ID: ${employee.id}) can handle all slots`,
    );

    for (const slot of slots) {
      if (
        !(await this.isEmployeeAvailableForSlot(ctx, slot, employee, serviceId))
      ) {
        return false;
      }
    }

    this.logger.log(
      ctx,
      `🔍 DEBUG: Employee ${employee.name} (ID: ${employee.id}) can handle all slots!`,
    );
    return true;
  }

  /**
   * Find an available employee for a specific slot
   */
  private async findEmployeeForSlot(
    ctx: RequestContext,
    slot: string,
    employees: User[],
    serviceId: number,
  ): Promise<User | undefined> {
    for (const employee of employees) {
      if (
        await this.isEmployeeAvailableForSlot(ctx, slot, employee, serviceId)
      ) {
        return employee;
      }
    }
    return undefined;
  }

  /**
   * Check if employee is available for a specific slot
   */
  private async isEmployeeAvailableForSlot(
    ctx: RequestContext,
    slot: string,
    employee: User,
    serviceId: number,
  ): Promise<boolean> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: Checking employee ${employee.name} availability for slot ${slot}`,
    );

    // Check working hours
    if (
      !this.employeeAvailabilityService.isEmployeeAvailableAtTime(
        employee,
        slot,
      )
    ) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Employee ${employee.name} not available during working hours for slot ${slot}`,
      );
      return false;
    }

    // Check Google Calendar availability (non-blocking; final DB reservation will validate again)
    try {
      const availableAtTime =
        await this.googleCalendarBookingService.getAvailableEmployeesAtTime(
          slot,
          [employee],
        );
      if (availableAtTime.length === 0) {
        this.logger.log(
          ctx,
          `🔍 DEBUG: Employee ${employee.name} not available in Google Calendar for slot ${slot} (non-blocking)`,
        );
      }
    } catch (error) {
      this.logger.warn(
        ctx,
        `Google Calendar availability check failed (non-blocking): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }

    // Check database availability
    const isDatabaseAvailable = await this.checkEmployeeDatabaseAvailability(
      ctx,
      slot,
      employee.id,
      serviceId, // Use first service ID or default
    );

    if (!isDatabaseAvailable) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Employee ${employee.name} not available in database for slot ${slot}`,
      );
      return false;
    }

    this.logger.log(
      ctx,
      `🔍 DEBUG: Employee ${employee.name} available for slot ${slot}`,
    );
    return true;
  }

  /**
   * Check if employee is available in database for a specific slot
   * @param ctx Request context
   * @param slot The slot time
   * @param employeeId The employee ID
   * @param serviceId The service ID
   * @returns true if available in database
   */
  async checkEmployeeDatabaseAvailability(
    ctx: RequestContext,
    slot: string,
    employeeId: number,
    serviceId: number,
  ): Promise<boolean> {
    // This method can be implemented to check database reservations
    // For now, we'll use the SlotAvailabilityService
    try {
      return await this.slotService.validateSlotStillAvailable(
        slot,
        employeeId,
        serviceId,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Error checking database availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Update employee assignment count
   * @param ctx Request context
   * @param employeeId The employee ID
   */
  async updateAssignmentCount(
    ctx: RequestContext,
    employeeId: number,
  ): Promise<void> {
    try {
      const employee = await this.userService.getUserById(ctx, employeeId);
      if (employee) {
        const currentCount = employee.lastAssignedOrderCount || 0;
        await this.userService.updateAssignmentCount(
          ctx,
          employeeId,
          currentCount + 1,
        );
        this.logger.log(
          ctx,
          `Updated assignment count for employee ${employeeId} to ${currentCount + 1}`,
        );
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to update assignment count for employee ${employeeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
