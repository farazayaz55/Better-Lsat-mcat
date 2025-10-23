import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../request-context/request-context.dto';
import { AppLogger } from '../../logger/logger.service';

@Injectable()
export class SlotGeneratorService {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(SlotGeneratorService.name);
  }

  /**
   * Generate time slots for entire day based on duration
   * @param date The date to generate slots for
   * @param durationMinutes Duration of each slot in minutes
   * @param ctx Optional request context for logging
   * @returns Array of ISO string slot times
   */
  generateTimeSlots(
    date: Date,
    durationMinutes: number,
    ctx?: RequestContext,
  ): string[] {
    const slots: string[] = [];
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // getUTCMonth() returns 0-11, so add 1
    const day = date.getUTCDate();

    // Generate slots for ALL 24 hours (0-23)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += durationMinutes) {
        const slotDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        slots.push(slotDate.toISOString());
      }
    }

    if (ctx) {
      this.logger.log(
        ctx,
        `Generated ${slots.length} time slots for ${day}/${month}/${year} (${durationMinutes}min intervals) - 24 hours`,
      );
    }

    return slots;
  }

  /**
   * Filter slots by grace period (e.g., 24 hours before)
   * @param slots Array of slot times
   * @param gracePeriodHours Grace period in hours
   * @returns Array of slots after grace period cutoff
   */
  applyGracePeriod(slots: string[], gracePeriodHours: number): string[] {
    const now = new Date();
    const gracePeriodCutoff = new Date(
      now.getTime() + gracePeriodHours * 60 * 60 * 1000,
    );

    return slots.filter(
      (slot) => !this.isSlotWithinGracePeriod(slot, gracePeriodCutoff),
    );
  }

  /**
   * Check if slot is within grace period (too close to current time)
   * @param slot The slot time to check
   * @param gracePeriodCutoff The cutoff time
   * @returns true if slot is within grace period
   */
  isSlotWithinGracePeriod(slot: string, gracePeriodCutoff: Date): boolean {
    const slotTime = new Date(slot);
    return slotTime <= gracePeriodCutoff;
  }

  /**
   * Generate slots for a specific date with grace period applied
   * @param date The date to generate slots for
   * @param durationMinutes Duration of each slot in minutes
   * @param gracePeriodHours Grace period in hours (default 24)
   * @param ctx Optional request context for logging
   * @returns Array of available slot times after grace period
   */
  generateAvailableSlots(
    date: Date,
    durationMinutes: number,
    gracePeriodHours = 24,
    ctx?: RequestContext,
  ): string[] {
    const allSlots = this.generateTimeSlots(date, durationMinutes, ctx);
    return this.applyGracePeriod(allSlots, gracePeriodHours);
  }
}
