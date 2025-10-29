import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class Reminder3DayAutomation extends BaseAutomation {
  readonly key = 'reminder-3day-sms';
  readonly name = '3 Day Reminder SMS';
  readonly description = 'Sends reminder SMS 3 days after order is paid';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.SMS;
  readonly defaultParameters = {
    delayMinutes: 4320, // 3 days
    message:
      'Hi {{customerName}}! Reminder: Your session is in 3 days on {{date}} at {{time}}. Order #{{orderNumber}}. - Better LSAT MCAT',
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

    // Get first appointment from items
    const firstAppointment = order.items[0]?.DateTime?.[0];
    let appointmentDate = 'TBD';
    let sessionTime = '';
    let sessionDateShort = '';

    if (firstAppointment) {
      const date = new Date(firstAppointment);
      appointmentDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      sessionTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      sessionDateShort = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    // Calculate days until session (approximately 3 days from now)
    const daysUntilSession = '3';

    const total = order.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    const orderDate = new Date().toLocaleDateString();
    const currency = order.currency || 'CAD';

    // Replace placeholders in message
    const message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      {
        orderNumber: order.id.toString(),
        orderId: order.id.toString(),
        orderDate,
        customerName: order.customer.name,
        customerFirstName: order.customer.name.split(' ')[0],
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        total: total.toFixed(2),
        currency,
        itemCount: order.items.length.toString(),
        sessionDate: appointmentDate,
        sessionTime,
        sessionDateShort,
        time: sessionTime,
        date: sessionDateShort,
        daysUntilSession,
        hoursUntilSession: '72',
      },
    );

    return {
      recipients: order.customer.phone,
      message,
      data: {
        orderNumber: order.id.toString(),
        orderId: order.id.toString(),
        orderDate,
        customerName: order.customer.name,
        customerFirstName: order.customer.name.split(' ')[0],
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        total: total.toFixed(2),
        currency,
        itemCount: order.items.length.toString(),
        sessionDate: appointmentDate,
        sessionTime,
        sessionDateShort,
        time: sessionTime,
        date: sessionDateShort,
        daysUntilSession,
        hoursUntilSession: '72',
      },
    };
  }

  private replacePlaceholders(
    template: string,
    values: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}
