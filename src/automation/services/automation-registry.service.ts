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
import { NoShowSmsAutomation } from '../automations/no-show-sms.automation';
import { NoShowEmailAutomation } from '../automations/no-show-email.automation';
import { OrderCompletedService5SmsAutomation } from '../automations/order-completed-service5-sms.automation';
import { OrderCompletedDefaultSmsAutomation } from '../automations/order-completed-default-sms.automation';

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
    private noShowSms: NoShowSmsAutomation,
    private noShowEmail: NoShowEmailAutomation,
    private completed5Sms: OrderCompletedService5SmsAutomation,
    private completedDefaultSms: OrderCompletedDefaultSmsAutomation,
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
    this.register(noShowSms);
    this.register(noShowEmail);
    this.register(completed5Sms);
    this.register(completedDefaultSms);
  }

  private register(automation: BaseAutomation): void {
    this.automations.set(automation.key, automation);
  }

  getByKey(key: string): BaseAutomation | undefined {
    return this.automations.get(key);
  }

  getByTriggerEvent(event: TriggerEvent): BaseAutomation[] {
    return [...this.automations.values()].filter(
      (a) => a.triggerEvent === event,
    );
  }

  getAll(): BaseAutomation[] {
    return [...this.automations.values()];
  }
}
