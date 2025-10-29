import { Injectable } from '@nestjs/common';
import { BaseAutomation } from '../automations/base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { OrderConfirmationAutomation } from '../automations/order-confirmation.automation';
import { Reminder24hAutomation } from '../automations/reminder-24h.automation';
import { Reminder30minAutomation } from '../automations/reminder-30min.automation';
import { SlackOrderNotificationAutomation } from '../automations/slack-order-notification.automation';
import { OrderConfirmationSmsAutomation } from '../automations/order-confirmation-sms.automation';
import { Reminder24hSmsAutomation } from '../automations/reminder-24h-sms.automation';
import { Reminder30minSmsAutomation } from '../automations/reminder-30min-sms.automation';

@Injectable()
export class AutomationRegistryService {
  private automations = new Map<string, BaseAutomation>();

  constructor(
    private orderConfirmation: OrderConfirmationAutomation,
    private reminder24h: Reminder24hAutomation,
    private reminder30min: Reminder30minAutomation,
    private slackNotification: SlackOrderNotificationAutomation,
    private orderConfirmationSms: OrderConfirmationSmsAutomation,
    private reminder24hSms: Reminder24hSmsAutomation,
    private reminder30minSms: Reminder30minSmsAutomation,
  ) {
    // Auto-register all automations
    this.register(orderConfirmation);
    this.register(reminder24h);
    this.register(reminder30min);
    this.register(slackNotification);
    // Register SMS automations
    this.register(orderConfirmationSms);
    this.register(reminder24hSms);
    this.register(reminder30minSms);
  }

  private register(automation: BaseAutomation): void {
    this.automations.set(automation.key, automation);
  }

  getByKey(key: string): BaseAutomation | undefined {
    return this.automations.get(key);
  }

  getByTriggerEvent(event: TriggerEvent): BaseAutomation[] {
    return Array.from(this.automations.values()).filter(
      (a) => a.triggerEvent === event,
    );
  }

  getAll(): BaseAutomation[] {
    return Array.from(this.automations.values());
  }
}
