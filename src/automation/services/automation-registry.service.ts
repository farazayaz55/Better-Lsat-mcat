import { Injectable } from '@nestjs/common';
import { BaseAutomation } from '../automations/base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { AutomationDiscoveryService } from './automation-discovery.service';
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
    orderConfirmation: OrderConfirmationAutomation,
    reminder24h: Reminder24hAutomation,
    reminder30min: Reminder30minAutomation,
    slackNotification: SlackOrderNotificationAutomation,
    orderConfirmationSms: OrderConfirmationSmsAutomation,
    reminder24hSms: Reminder24hSmsAutomation,
    reminder30minSms: Reminder30minSmsAutomation,
  ) {
    // Auto-register all automations using discovery service
    const automations: BaseAutomation[] = [
      orderConfirmation,
      reminder24h,
      reminder30min,
      slackNotification,
      orderConfirmationSms,
      reminder24hSms,
      reminder30minSms,
    ];

    AutomationDiscoveryService.registerAutomations(this, automations);
  }

  /**
   * Register an automation (called by discovery service)
   */
  register(automation: BaseAutomation): void {
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
