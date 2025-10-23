import { Injectable } from '@nestjs/common';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class EmployeeAvailabilityService {
  private debugLogged = new Set<string>();

  /**
   * Check if employee is available at specific time based on work hours
   * @param employee The employee to check
   * @param slotTime The slot time in ISO string format
   * @returns true if employee is available during their work hours
   */
  isEmployeeAvailableAtTime(employee: User, slotTime: string): boolean {
    const slotDate = new Date(slotTime);
    const dayOfWeek = this.getDayOfWeekName(slotDate.getDay());
    const slotHour = slotDate.getUTCHours();
    const slotMinute = slotDate.getUTCMinutes();
    const slotTimeInMinutes = slotHour * 60 + slotMinute;

    // Get employee's working hours for this day
    // eslint-disable-next-line security/detect-object-injection
    const dayWorkHours = employee.workHours?.[dayOfWeek] || [];

    // Debug log for first few checks to understand availability
    const debugKey = `${employee.id}-${dayOfWeek}-${slotHour}:${slotMinute.toString().padStart(2, '0')}`;
    if (!this.debugLogged.has(debugKey)) {
      this.debugLogged.add(debugKey);
      console.log(
        `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - ${dayOfWeek} ${slotHour}:${slotMinute.toString().padStart(2, '0')} UTC - Work hours: ${JSON.stringify(dayWorkHours)}`,
      );
    }

    if (dayWorkHours.length === 0) {
      console.log(
        `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - No work hours for ${dayOfWeek}`,
      );
      console.log(
        `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - Returning FALSE for availability`,
      );
      return false; // No working hours defined for this day
    }

    // Check if slot time falls within any working hour range
    for (const timeRange of dayWorkHours) {
      const [startTime, endTime] = timeRange.split('-');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      const startTimeInMinutes = startHour * 60 + startMin;
      const endTimeInMinutes = endHour * 60 + endMin;

      console.log(
        `🔍 DEBUG: Employee ${employee.name} - Checking ${slotHour}:${slotMinute.toString().padStart(2, '0')} (${slotTimeInMinutes} min) against ${startTime}-${endTime} (${startTimeInMinutes}-${endTimeInMinutes} min)`,
      );

      if (
        slotTimeInMinutes >= startTimeInMinutes &&
        slotTimeInMinutes < endTimeInMinutes
      ) {
        console.log(`🔍 DEBUG: Employee ${employee.name} - AVAILABLE!`);
        return true;
      }
    }

    console.log(`🔍 DEBUG: Employee ${employee.name} - NOT AVAILABLE`);
    console.log(
      `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - Returning FALSE for availability (outside work hours)`,
    );
    return false;
  }

  /**
   * Filter employees by their work hours for given slots
   * @param employees Array of employees to filter
   * @param slots Array of slot times to check
   * @returns Map of slot times to available employees
   */
  filterEmployeesByWorkHours(
    employees: User[],
    slots: string[],
  ): Map<string, User[]> {
    const result = new Map<string, User[]>();

    for (const slot of slots) {
      const availableEmployees = employees.filter((emp) =>
        this.isEmployeeAvailableAtTime(emp, slot),
      );
      result.set(slot, availableEmployees);
    }

    return result;
  }

  /**
   * Get day name from day number
   * @param dayNumber Day number (0 = Sunday, 1 = Monday, etc.)
   * @returns Day name string
   */
  getDayOfWeekName(dayNumber: number): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    // eslint-disable-next-line security/detect-object-injection
    return days[dayNumber];
  }

  /**
   * Check if multiple employees are available for a slot
   * @param employees Array of employees to check
   * @param slotTime The slot time to check
   * @returns Array of available employees
   */
  getAvailableEmployeesForSlot(employees: User[], slotTime: string): User[] {
    return employees.filter((emp) =>
      this.isEmployeeAvailableAtTime(emp, slotTime),
    );
  }
}
