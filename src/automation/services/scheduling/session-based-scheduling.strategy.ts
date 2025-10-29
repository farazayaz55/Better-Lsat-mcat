import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { BaseAutomation } from '../../automations/base-automation';
import { AutomationJobData } from '../../queues/interfaces/automation-job.interface';
import {
  SchedulingStrategy,
  SchedulingPayload,
} from './scheduling-strategy.interface';
import { AutomationConfig } from '../../entities/automation-config.entity';
import { AppLogger } from '../../../shared/logger/logger.service';

@Injectable()
export class SessionBasedSchedulingStrategy implements SchedulingStrategy {
  constructor(
    @InjectQueue('automation') private automationQueue: Queue,
    private logger: AppLogger,
  ) {
    this.logger.setContext(SessionBasedSchedulingStrategy.name);
  }

  async schedule(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: AutomationConfig,
    payload: SchedulingPayload,
  ): Promise<void> {
    const { order } = payload;

    if (!order?.items) {
      this.logger.warn(
        ctx,
        `Cannot schedule session-based automation ${automation.key}: order has no items`,
      );
      return;
    }

    const scheduledCount = await this.scheduleForAllSessions(
      ctx,
      automation,
      config,
      payload,
    );

    this.logger.log(
      ctx,
      `Scheduled ${scheduledCount} automation jobs for ${automation.key}`,
    );
  }

  private async scheduleForAllSessions(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: AutomationConfig,
    payload: SchedulingPayload,
  ): Promise<number> {
    const { order } = payload;
    let scheduledCount = 0;

    // Extract all session times from order items
    const sessionTimes: { dateTime: string; index: number }[] = [];

    if (order?.items) {
      for (let itemIndex = 0; itemIndex < order.items.length; itemIndex++) {
        const item = order.items[itemIndex];
        if (item.DateTime && Array.isArray(item.DateTime)) {
          for (let dtIndex = 0; dtIndex < item.DateTime.length; dtIndex++) {
            const dateTime = item.DateTime[dtIndex];
            if (dateTime) {
              sessionTimes.push({
                dateTime,
                index: itemIndex * 1000 + dtIndex, // Unique index
              });
            }
          }
        }
      }
    }

    this.logger.log(
      ctx,
      `Found ${sessionTimes.length} sessions for automation ${automation.key}`,
    );

    const now = Date.now();

    for (const sessionData of sessionTimes) {
      const sessionTime = new Date(sessionData.dateTime).getTime();

      // Skip if session is in the past
      if (sessionTime <= now) {
        this.logger.log(
          ctx,
          `Skipping ${automation.key} for session ${sessionData.dateTime} - session is in the past`,
        );
        continue;
      }

      // Calculate delay based on automation type
      let delayMs = 0;

      // Determine delay based on automation key (24h vs 30min)
      // This is still needed to distinguish between 24h and 30min reminders
      if (
        automation.key.includes('24h') ||
        automation.key.includes('24-hour')
      ) {
        // 24 hours before session
        delayMs = sessionTime - now - 24 * 60 * 60 * 1000;
      } else if (
        automation.key.includes('30min') ||
        automation.key.includes('30-min')
      ) {
        // 30 minutes before session
        delayMs = sessionTime - now - 30 * 60 * 1000;
      } else {
        this.logger.warn(
          ctx,
          `Unknown session-based automation timing: ${automation.key}. Expected 24h or 30min in key.`,
        );
        continue;
      }

      // Log the calculation for debugging
      this.logger.log(
        ctx,
        `Calculated delay for ${automation.key}: ${Math.round(
          delayMs / 60_000,
        )} minutes (session in ${Math.round((sessionTime - now) / 60_000)} minutes)`,
      );

      // Only schedule if the reminder time hasn't passed (allow at least 1 minute)
      if (delayMs >= 60_000) {
        const sessionPayload = {
          ...payload,
          sessionDateTime: sessionData.dateTime,
          sessionIndex: sessionData.index,
        };

        const jobData: AutomationJobData = {
          automationKey: automation.key,
          eventData: sessionPayload,
          config,
          ctx,
          createdAt: new Date(),
          metadata: {
            triggerEvent: automation.triggerEvent,
            sessionDateTime: sessionData.dateTime,
            delayMs,
          },
        };

        await this.automationQueue.add('execute', jobData, {
          delay: delayMs,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: {
            age: 86_400, // Keep for 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 604_800, // Keep for 7 days
            count: 500,
          },
        });

        scheduledCount++;

        this.logger.log(
          ctx,
          `✅ Scheduled ${automation.key} for session ${sessionData.dateTime} in ${Math.round(
            delayMs / 60_000,
          )} minutes`,
        );
      } else {
        const reminderType = automation.key.includes('24h')
          ? '24 hours'
          : automation.key.includes('30min')
            ? '30 minutes'
            : 'unknown';
        this.logger.warn(
          ctx,
          `⚠️ Skipping ${automation.key} for session ${sessionData.dateTime} - ${reminderType} reminder time has passed or is too soon (delay: ${Math.round(
            delayMs / 60_000,
          )} minutes)`,
        );
      }
    }

    return scheduledCount;
  }
}
