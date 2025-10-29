import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { BaseAutomation } from '../../automations/base-automation';
import type { AutomationConfig } from '../../entities/automation-config.entity';

export interface SchedulingPayload {
  order?: any;
  ctx?: RequestContext;
  [key: string]: any;
}

/**
 * Strategy interface for scheduling automation executions
 */
export interface SchedulingStrategy {
  /**
   * Schedule an automation for execution
   * @param ctx - Request context
   * @param automation - The automation to schedule
   * @param config - Automation configuration
   * @param payload - Event payload containing order data
   * @returns Promise that resolves when scheduling is complete
   */
  schedule(
    ctx: RequestContext,
    automation: BaseAutomation,
    config: AutomationConfig,
    payload: SchedulingPayload,
  ): Promise<void>;
}
