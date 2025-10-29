import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { AutomationRegistryService } from '../services/automation-registry.service';
import { ToolRegistryService } from '../services/tool-registry.service';
import { AppLogger } from '../../shared/logger/logger.service';
import { AutomationJobData } from './interfaces/automation-job.interface';

@Injectable()
@Processor('automation')
export class AutomationProcessor {
  constructor(
    private registry: AutomationRegistryService,
    private toolRegistry: ToolRegistryService,
    private logger: AppLogger,
  ) {
    this.logger.setContext(AutomationProcessor.name);
  }

  @Process('execute')
  async handleAutomationExecution(job: Job<AutomationJobData>) {
    const { automationKey, eventData, config, ctx } = job.data;

    this.logger.log(
      ctx,
      `Processing automation job ${job.id} for automation: ${automationKey}`,
    );

    try {
      // Get the automation
      const automation = this.registry.getByKey(automationKey);
      if (!automation) {
        throw new Error(`Automation ${automationKey} not found in registry`);
      }

      // Get the tool
      const tool = this.toolRegistry.getTool(automation.toolType);

      if (!tool.isConfigured()) {
        throw new Error(
          `Tool ${automation.toolType} is not properly configured`,
        );
      }

      // Build payload for tool
      const toolPayload = await automation.buildPayload(
        eventData,
        config.parameters,
      );

      // Skip if automation returned null (conditional execution)
      if (!toolPayload) {
        this.logger.log(
          ctx,
          `Automation ${automationKey} skipped (buildPayload returned null)`,
        );
        return { skipped: true, automationKey };
      }

      // Send using tool
      await tool.send(toolPayload);

      this.logger.log(
        ctx,
        `Automation ${automationKey} executed successfully from queue`,
      );

      return {
        success: true,
        automationKey,
        jobId: job.id.toString(),
        toolType: automation.toolType,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        ctx,
        `Automation ${automationKey} execution failed: ${errorMessage}`,
      );
      throw error; // Re-throw to mark job as failed
    }
  }

  @OnQueueActive()
  onActive(job: Job<AutomationJobData>) {
    this.logger.log(
      { requestID: 'queue', url: '', ip: '', user: null },
      `Automation job ${job.id} started processing`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<AutomationJobData>, result: any) {
    this.logger.log(
      { requestID: 'queue', url: '', ip: '', user: null },
      `Automation job ${job.id} completed: ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<AutomationJobData>, error: Error) {
    this.logger.error(
      { requestID: 'queue', url: '', ip: '', user: null },
      `Automation job ${job.id} failed: ${error.message}`,
    );
  }
}
