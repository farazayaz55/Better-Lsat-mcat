import { Test, TestingModule } from '@nestjs/testing';
import { SchedulingStrategyFactory } from './scheduling-strategy-factory';
import { FixedDelaySchedulingStrategy } from './fixed-delay-scheduling.strategy';
import { SessionBasedSchedulingStrategy } from './session-based-scheduling.strategy';
import { BaseAutomation } from '../../automations/base-automation';
import { TriggerEvent } from '../../constants/trigger-events.constant';
import { ToolType } from '../../constants/tool-types.constant';

class MockFixedDelayAutomation extends BaseAutomation {
  readonly key = 'test-fixed-delay';
  readonly name = 'Test Fixed Delay';
  readonly description = 'Test';
  readonly triggerEvent = TriggerEvent.ORDER_CREATED;
  readonly toolType = ToolType.EMAIL;
  readonly schedulingType = 'fixed-delay';
  readonly defaultParameters = {};

  async buildPayload() {
    return null;
  }
}

class MockSessionBasedAutomation extends BaseAutomation {
  readonly key = 'test-session-based';
  readonly name = 'Test Session Based';
  readonly description = 'Test';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.EMAIL;
  readonly schedulingType = 'session-based';
  readonly defaultParameters = {};

  async buildPayload() {
    return null;
  }
}

describe('SchedulingStrategyFactory', () => {
  let factory: SchedulingStrategyFactory;
  let fixedDelayStrategy: FixedDelaySchedulingStrategy;
  let sessionBasedStrategy: SessionBasedSchedulingStrategy;

  beforeEach(async () => {
    fixedDelayStrategy = {
      schedule: jest.fn(),
    } as any;

    sessionBasedStrategy = {
      schedule: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingStrategyFactory,
        {
          provide: FixedDelaySchedulingStrategy,
          useValue: fixedDelayStrategy,
        },
        {
          provide: SessionBasedSchedulingStrategy,
          useValue: sessionBasedStrategy,
        },
      ],
    }).compile();

    factory = module.get<SchedulingStrategyFactory>(SchedulingStrategyFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  it('should return fixed delay strategy for fixed-delay automation', () => {
    const automation = new MockFixedDelayAutomation();
    const strategy = factory.getStrategy(automation);
    expect(strategy).toBe(fixedDelayStrategy);
  });

  it('should return session-based strategy for session-based automation', () => {
    const automation = new MockSessionBasedAutomation();
    const strategy = factory.getStrategy(automation);
    expect(strategy).toBe(sessionBasedStrategy);
  });
});
