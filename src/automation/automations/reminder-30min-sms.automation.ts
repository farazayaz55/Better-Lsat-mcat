import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class Reminder30minSmsAutomation extends BaseAutomation {
  readonly key = 'reminder-30min-sms';
  readonly name = '30 Minute Reminder SMS';
  readonly description = 'Sends SMS reminder 30 minutes before session';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.SMS;
  readonly schedulingType = 'session-based' as const;
  readonly defaultParameters = {
    delayMinutes: 0, // Will be calculated based on session time
    message:
      'Hey {{custName}}! Your appointment for Order #{{order_number}} - {{packageName}} starts at {{dateTime}}. Please join: {{meetingLink}} - Better LSAT MCAT',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { order } = eventData;

    // Check if customer has phone number
    if (!order.customer.phone) {
      return null; // Skip SMS if no phone number
    }

    // Get the specific session being reminded about
    const sessionDateTime = eventData.sessionDateTime;
    const sessionDate = sessionDateTime
      ? new Date(sessionDateTime)
      : new Date();

    // Format date and time nicely (compact for SMS)
    const formattedDateTime = sessionDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    // Get package name from first item
    const firstItem =
      order.items && order.items.length > 0 ? order.items[0] : null;
    const packageName = firstItem?.name || 'Prep Session';

    const meetingLink = order.googleMeetLink || 'Not available';

    // Replace placeholders in message
    const message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      {
        custName: order.customer.name,
        customerName: order.customer.name,
        customerFirstName: order.customer.name.split(' ')[0],
        order_number: order.id.toString(),
        orderNumber: order.id.toString(),
        orderId: order.id.toString(),
        packageName,
        dateTime: formattedDateTime,
        meetingLink,
      },
    );

    return {
      recipients: order.customer.phone,
      message,
      data: {
        custName: order.customer.name,
        customerName: order.customer.name,
        customerFirstName: order.customer.name.split(' ')[0],
        order_number: order.id.toString(),
        orderNumber: order.id.toString(),
        orderId: order.id.toString(),
        packageName,
        dateTime: formattedDateTime,
        meetingLink,
      },
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
