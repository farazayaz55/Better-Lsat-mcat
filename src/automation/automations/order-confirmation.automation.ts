import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class OrderConfirmationAutomation extends BaseAutomation {
  readonly key = 'order-confirmation-email';
  readonly name = 'Order Confirmation Email';
  readonly description =
    'Sends immediate confirmation email when payment is received';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.EMAIL;
  readonly defaultParameters = {
    delayMinutes: 0,
    ccRecipients: [],
    template: 'order-confirmation',
    subject: 'Order #{{orderNumber}} Confirmed - Better LSAT MCAT',
    message:
      'Your order #{{orderNumber}} has been confirmed. Total: ${{total}}\n\nYou can join your lecture using this meeting link: {{meetLink}}',
  };

  async buildPayload(eventData: any, parameters: any): Promise<ToolPayload> {
    const { order } = eventData;
    console.log(
      `[Email Automation] Order googleMeetLink: ${order.googleMeetLink || 'MISSING'}`,
    );

    const total = order.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    const orderDate = new Date().toLocaleDateString();

    // Replace placeholders in subject and message
    const subject = this.replacePlaceholders(
      parameters.subject || this.defaultParameters.subject,
      {
        orderNumber: order.id,
        customerName: order.customer.name,
        total: total.toFixed(2),
        currency: 'CAD',
        itemCount: order.items.length.toString(),
        orderDate,
        meetLink: order.googleMeetLink || 'Not available yet',
      },
    );

    const message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      {
        orderNumber: order.id,
        customerName: order.customer.name,
        total: total.toFixed(2),
        currency: 'CAD',
        itemCount: order.items.length.toString(),
        orderDate,
        meetLink: order.googleMeetLink || 'Not available yet',
      },
    );

    return {
      recipients: order.customer.email,
      subject,
      template: parameters.template || this.defaultParameters.template,
      data: {
        orderNumber: order.id,
        customerName: order.customer.name,
        items: order.items,
        total,
        currency: 'CAD',
        orderDate,
        meetLink: order.googleMeetLink || 'Not available yet',
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
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}
