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
import { RequestContextFactory } from '../../shared/services/request-context-factory.service';
import { SchedulingStrategyFactory } from './scheduling/scheduling-strategy-factory';
import { AutomationConfig } from '../entities/automation-config.entity';

@Injectable()
export class AutomationExecutorService {
  constructor(
    private registry: AutomationRegistryService,
    private toolRegistry: ToolRegistryService,
    private configService: AutomationConfigService,
    @InjectRepository(AutomationLog)
    private logRepository: Repository<AutomationLog>,
    @InjectQueue('automation') private automationQueue: Queue,
    private contextFactory: RequestContextFactory,
    private schedulingStrategyFactory: SchedulingStrategyFactory,
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
    const ctx = payload.ctx || this.contextFactory.createSystemContext();
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

      // Auto-enable reminder automations (session-based) if they exist but are disabled
      if (!config.isEnabled) {
        const isReminderAutomation =
          automation.schedulingType === 'session-based';

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

      // Determine scheduling type from automation property
      const isSessionBased = automation.schedulingType === 'session-based';

      this.logger.log(
        ctx,
        `Automation ${automation.key}: schedulingType=${automation.schedulingType}, hasItems=${!!order?.items}, delayMinutes=${config.parameters.delayMinutes}`,
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
    config: AutomationConfig,
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
    config: AutomationConfig,
    payload: any,
  ): Promise<void> {
    const event = automation.triggerEvent;

    this.logger.log(
      ctx,
      `scheduleExecution for ${automation.key}: schedulingType=${automation.schedulingType}`,
    );

    // Get the appropriate strategy based on automation type
    const strategy = this.schedulingStrategyFactory.getStrategy(automation);

    // Delegate to the strategy
    await strategy.schedule(ctx, automation, config, payload);

    // Log as pending
    await this.log(automation.key, event, payload, 'pending');
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
}
