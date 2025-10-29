import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { AutomationRegistryService } from './automation-registry.service';
import { ToolRegistryService } from './tool-registry.service';
import { AutomationConfigService } from './automation-config.service';
import { AutomationLog } from '../entities/automation-log.entity';
import { BaseAutomation } from '../automations/base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AutomationJobData } from '../queues/interfaces/automation-job.interface';

@Injectable()
export class AutomationExecutorService {
  constructor(
    private registry: AutomationRegistryService,
    private toolRegistry: ToolRegistryService,
    private configService: AutomationConfigService,
    @InjectRepository(AutomationLog)
    private logRepository: Repository<AutomationLog>,
    @InjectQueue('automation') private automationQueue: Queue,
    private logger: AppLogger,
  ) {
    this.logger.setContext(AutomationExecutorService.name);
  }

  @OnEvent(TriggerEvent.ORDER_CREATED)
  async handleOrderCreated(payload: any) {
    await this.executeForEvent(TriggerEvent.ORDER_CREATED, payload);
  }

  @OnEvent(TriggerEvent.ORDER_PAID)
  async handleOrderPaid(payload: any) {
    await this.executeForEvent(TriggerEvent.ORDER_PAID, payload);
  }

  private async executeForEvent(event: TriggerEvent, payload: any) {
    const ctx = payload.ctx || this.createSystemContext();
    const automations = this.registry.getByTriggerEvent(event);
    const { order } = payload;

    this.logger.log(
      ctx,
      `Event ${event} triggered, found ${automations.length} automations`,
    );

    for (const automation of automations) {
      // Get or create config (will auto-enable reminders if creating new)
      let config = await this.configService.getOrCreate(automation.key, {
        name: automation.name,
        description: automation.description,
        triggerEvent: automation.triggerEvent,
        toolType: automation.toolType,
        defaultParameters: automation.defaultParameters,
      });

      // Auto-enable reminder automations if they exist but are disabled
      if (!config.isEnabled) {
        const isReminderAutomation =
          automation.key.includes('24h') ||
          automation.key.includes('30min') ||
          automation.key.includes('reminder');

        if (isReminderAutomation) {
          config = await this.configService.update(automation.key, {
            isEnabled: true,
          });
          this.logger.log(
            ctx,
            `Auto-enabled reminder automation: ${automation.key}`,
          );
        }
      }

      if (!config.isEnabled) {
        this.logger.log(
          ctx,
          `Automation ${automation.key} is disabled, skipping`,
        );
        continue;
      }

      // Determine if this is a session-based automation
      const isSessionBased =
        automation.key.includes('24h') ||
        automation.key.includes('30min') ||
        automation.key.includes('reminder');

      this.logger.log(
        ctx,
        `Automation ${automation.key}: isSessionBased=${isSessionBased}, hasItems=${!!order?.items}, delayMinutes=${config.parameters.delayMinutes}`,
      );

      // Schedule or execute immediately
      if (isSessionBased && order?.items) {
        // For session-based automations, schedule for each session
        this.logger.log(
          ctx,
          `Routing ${automation.key} to session-based scheduling`,
        );
        await this.scheduleExecution(ctx, automation, config, payload);
      } else if (config.parameters.delayMinutes > 0) {
        await this.scheduleExecution(ctx, automation, config, payload);
      } else {
        await this.executeNow(ctx, automation, config, payload);
      }
    }
  }

  private async executeNow(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: any,
    payload: any,
  ) {
    const event = automation.triggerEvent;
    try {
      this.logger.log(ctx, `Executing automation: ${automation.key}`);

      // Get the tool
      const tool = this.toolRegistry.getTool(automation.toolType);

      if (!tool.isConfigured()) {
        throw new Error(
          `Tool ${automation.toolType} is not properly configured`,
        );
      }

      // Build payload for tool
      const toolPayload = await automation.buildPayload(
        payload,
        config.parameters,
      );

      // Skip if automation returned null (conditional execution)
      if (!toolPayload) {
        this.logger.log(
          ctx,
          `Automation ${automation.key} skipped (buildPayload returned null)`,
        );
        return;
      }

      // Send using tool
      await tool.send(toolPayload);

      // Log success
      await this.log(automation.key, event, payload, 'success');
      this.logger.log(
        ctx,
        `Automation ${automation.key} executed successfully`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.log(automation.key, event, payload, 'failed', errorMessage);
      this.logger.error(
        ctx,
        `Automation ${automation.key} failed: ${errorMessage}`,
      );
    }
  }

  private async scheduleExecution(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: any,
    payload: any,
  ) {
    const event = automation.triggerEvent;
    const { order } = payload;

    // Determine if this is a session-based automation by key
    const isSessionBased =
      automation.key.includes('24h') ||
      automation.key.includes('30min') ||
      automation.key.includes('reminder');

    this.logger.log(
      ctx,
      `scheduleExecution for ${automation.key}: isSessionBased=${isSessionBased}, hasItems=${!!order?.items}`,
    );

    // Check if this automation needs to run for multiple sessions
    if (isSessionBased && order?.items) {
      // This is a session-time-based automation
      // Schedule for each session in the order
      this.logger.log(
        ctx,
        `Calling scheduleForAllSessions for ${automation.key}`,
      );
      const sessionCount = await this.scheduleForAllSessions(
        ctx,
        automation,
        config,
        payload,
      );

      this.logger.log(
        ctx,
        `Scheduled ${sessionCount} automation jobs for ${automation.key}`,
      );

      // Log as pending
      await this.log(automation.key, event, payload, 'pending');
      return;
    }

    // Legacy fixed delay logic (for automations like 3-day reminder)
    const delayMs = config.parameters.delayMinutes * 60 * 1000;

    this.logger.log(
      ctx,
      `Scheduling automation ${automation.key} to run in ${config.parameters.delayMinutes} minutes via Bull Queue`,
    );

    // Use Bull Queue for reliable job scheduling
    const jobData: AutomationJobData = {
      automationKey: automation.key,
      eventData: payload,
      config,
      ctx,
      createdAt: new Date(),
      metadata: {
        triggerEvent: event,
        delayMinutes: config.parameters.delayMinutes,
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
        age: 86400, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604800, // Keep for 7 days
        count: 500,
      },
    });

    // Log as pending
    await this.log(automation.key, event, payload, 'pending');
  }

  private async scheduleForAllSessions(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: any,
    payload: any,
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
          `Unknown automation type for session-based scheduling: ${automation.key}`,
        );
        continue;
      }

      // Log the calculation for debugging
      this.logger.log(
        ctx,
        `Calculated delay for ${automation.key}: ${Math.round(
          delayMs / 60000,
        )} minutes (session in ${Math.round((sessionTime - now) / 60000)} minutes)`,
      );

      // Only schedule if the reminder time hasn't passed (allow at least 1 minute)
      if (delayMs >= 60000) {
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
            age: 86400, // Keep for 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 604800, // Keep for 7 days
            count: 500,
          },
        });

        scheduledCount++;

        this.logger.log(
          ctx,
          `✅ Scheduled ${automation.key} for session ${sessionData.dateTime} in ${Math.round(
            delayMs / 60000,
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
            delayMs / 60000,
          )} minutes)`,
        );
      }
    }

    return scheduledCount;
  }

  private async log(
    key: string,
    event: string,
    payload: any,
    status: string,
    error?: string,
  ) {
    await this.logRepository.save({
      automationKey: key,
      triggerEvent: event,
      toolType: this.registry.getByKey(key)?.toolType,
      eventData: payload,
      status,
      error,
      executedAt: new Date(),
    });
  }

  private createSystemContext(): RequestContext {
    return {
      user: { id: 0, username: 'system', roles: [] },
      requestID: 'automation-system',
      url: '/automation',
      ip: '127.0.0.1',
    } as RequestContext;
  }
}
