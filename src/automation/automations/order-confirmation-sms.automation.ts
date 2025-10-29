import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class OrderConfirmationSmsAutomation extends BaseAutomation {
  readonly key = 'order-confirmation-sms';
  readonly name = 'Order Confirmation SMS';
  readonly description =
    'Sends immediate SMS confirmation when payment is received';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.SMS;
  readonly defaultParameters = {
    delayMinutes: 0,
    message:
      'Hi {{customerName}}! Your order #{{orderNumber}} is confirmed. Total: ${{total}} {{currency}}. Join your lecture: {{meetLink}} - Better LSAT MCAT',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { order } = eventData;
    console.log(
      `[SMS Automation] Order googleMeetLink: ${order.googleMeetLink || 'MISSING'}`,
    );

    // Check if customer has phone number
    if (!order.customer.phone) {
      return null; // Skip SMS if no phone number
    }

    // Calculate total
    const total = order.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    // Format order date
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Get currency
    const currency = order.currency || 'CAD';

    // Replace placeholders in message
    const placeholderValues = {
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
      meetLink: order.googleMeetLink || 'Not available yet',
    };

    console.log(
      '[SMS Automation] Placeholder values:',
      JSON.stringify(placeholderValues),
    );

    let message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      placeholderValues,
    );

    console.log('[SMS Automation] Final message:', message);

    // If meeting link is not in the message, append it
    const meetLinkValue = order.googleMeetLink || 'Not available yet';
    if (!message.includes(meetLinkValue) && !message.includes('{{meetLink}}')) {
      message = `${message}\n\nJoin your lecture: ${meetLinkValue} - Better LSAT MCAT`;
      console.log('[SMS Automation] Appended meeting link to message');
    }

    return {
      recipients: order.customer.phone,
      message,
      data: placeholderValues,
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
