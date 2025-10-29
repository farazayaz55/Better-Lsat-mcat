import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class SlackOrderNotificationAutomation extends BaseAutomation {
  readonly key = 'slack-new-order';
  readonly name = 'Slack Payment Notification';
  readonly description = 'Sends Slack notification when payment is received';
  readonly triggerEvent = TriggerEvent.ORDER_PAID;
  readonly toolType = ToolType.SLACK;
  readonly schedulingType = 'fixed-delay' as const;
  readonly defaultParameters = {
    delayMinutes: 0,
    channel: '#orders',
    customMessage:
      '🎉 New order #{{orderId}} from {{customerName}} - ${{total}}',
    customBlockMessage: 'New Order #{{orderId}}',
  };

  async buildPayload(eventData: any, parameters: any): Promise<ToolPayload> {
    const { order } = eventData;

    const total = order.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    );

    // Format order items for display
    const formattedItems = order.items
      .map(
        (item: any) =>
          `  • ${item.name} x${item.quantity} - $${item.price} CAD`,
      )
      .join('\n');

    // Build default values for placeholder replacement
    const placeholderValues = {
      orderId: order.id.toString(),
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      customerPhone: order.customer.phone || 'N/A',
      total: total.toString(),
      currency: 'CAD',
      itemCount: order.items.length.toString(),
      meetLink: order.googleMeetLink || 'Not available yet',
    };

    // Use custom message if provided, otherwise use default
    const message = this.replacePlaceholders(
      parameters.customMessage || this.defaultParameters.customMessage,
      placeholderValues,
    );
    const blockText = this.replacePlaceholders(
      parameters.customBlockMessage ||
        this.defaultParameters.customBlockMessage,
      placeholderValues,
    );

    return {
      recipients: parameters.channel,
      channel: parameters.channel,
      message,
      data: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text:
                blockText +
                '\n' +
                `Customer: ${order.customer.name}\n` +
                `Email: ${order.customer.email}\n` +
                `Phone: ${order.customer.phone || 'N/A'}\n` +
                `Total: $${total} CAD\n` +
                `Items (${order.items.length}):\n${formattedItems}\n` +
                `Meeting Link: ${order.googleMeetLink || 'Not available yet'}`,
            },
          },
        ],
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
