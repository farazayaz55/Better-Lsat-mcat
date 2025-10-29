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
export class FixedDelaySchedulingStrategy implements SchedulingStrategy {
  constructor(
    @InjectQueue('automation') private automationQueue: Queue,
    private logger: AppLogger,
  ) {
    this.logger.setContext(FixedDelaySchedulingStrategy.name);
  }

  async schedule(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: AutomationConfig,
    payload: SchedulingPayload,
  ): Promise<void> {
    const delayMs = (config.parameters.delayMinutes || 0) * 60 * 1000;

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
        triggerEvent: automation.triggerEvent,
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
        age: 86_400, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 604_800, // Keep for 7 days
        count: 500,
      },
    });
  }
}
