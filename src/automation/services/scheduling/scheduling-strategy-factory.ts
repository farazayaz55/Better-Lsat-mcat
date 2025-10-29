import { Injectable } from '@nestjs/common';
import { BaseAutomation } from '../../automations/base-automation';
import { SchedulingStrategy } from './scheduling-strategy.interface';
import { FixedDelaySchedulingStrategy } from './fixed-delay-scheduling.strategy';
import { SessionBasedSchedulingStrategy } from './session-based-scheduling.strategy';

/**
 * Factory for selecting the appropriate scheduling strategy based on automation type
 */

@Injectable()
export class SchedulingStrategyFactory {
  constructor(
    private readonly fixedDelayStrategy: FixedDelaySchedulingStrategy,
    private readonly sessionBasedStrategy: SessionBasedSchedulingStrategy,
  ) {}

  /**
   * Get the appropriate scheduling strategy for an automation
   * @param automation - The automation to get strategy for
   * @returns The scheduling strategy instance
   */
  getStrategy(automation: BaseAutomation): SchedulingStrategy {
    if (automation.schedulingType === 'session-based') {
      return this.sessionBasedStrategy;
    }
    return this.fixedDelayStrategy;
  }
}
