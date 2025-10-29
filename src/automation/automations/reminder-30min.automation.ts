import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class Reminder30minAutomation extends BaseAutomation {
  readonly key = 'reminder-30min-email';
  readonly name = '30 Minute Reminder Email';
  readonly description = 'Sends reminder email 30 minutes before session';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.EMAIL;
  readonly schedulingType = 'session-based' as const;
  readonly defaultParameters = {
    delayMinutes: 0, // Will be calculated based on session time
    template: 'reminder-30min',
    subject: '⏰ Your session starts in 30 minutes! - Better LSAT MCAT',
    message:
      'Hey {{custName}}, your appointment for Order #{{order_number}} - {{packageName}} starts at {{dateTime}}. Please join: {{meetingLink}}',
  };

  async buildPayload(eventData: any, parameters: any): Promise<ToolPayload> {
    const { order } = eventData;

    // Get the specific session being reminded about
    const sessionDateTime = eventData.sessionDateTime;
    const sessionDate = sessionDateTime
      ? new Date(sessionDateTime)
      : new Date();

    // Format date and time nicely
    const formattedDateTime = sessionDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Get package name from first item
    const firstItem =
      order.items && order.items.length > 0 ? order.items[0] : null;
    const packageName = firstItem?.name || 'Prep Session';

    const meetingLink = order.googleMeetLink || null;

    // Replace placeholders in subject and message
    const subject = this.replacePlaceholders(
      parameters.subject || this.defaultParameters.subject,
      {
        custName: order.customer.name,
        customerName: order.customer.name,
        order_number: order.id.toString(),
        orderNumber: order.id.toString(),
        packageName,
        dateTime: formattedDateTime,
        meetingLink: meetingLink || 'Not available',
      },
    );

    const message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      {
        custName: order.customer.name,
        customerName: order.customer.name,
        order_number: order.id.toString(),
        orderNumber: order.id.toString(),
        packageName,
        dateTime: formattedDateTime,
        meetingLink: meetingLink || 'Not available',
      },
    );

    return {
      recipients: order.customer.email,
      subject,
      template: parameters.template || this.defaultParameters.template,
      data: {
        custName: order.customer.name,
        customerName: order.customer.name,
        order_number: order.id.toString(),
        orderNumber: order.id.toString(),
        packageName,
        dateTime: formattedDateTime,
        meetingLink,
      },
      message,
    };
  }

  private replacePlaceholders(
    template: string,
    values: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }
}
