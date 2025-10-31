import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class OrderCompletedDefaultSmsAutomation extends BaseAutomation {
  readonly key = 'order-completed-default-sms';
  readonly name = 'Order Completed (Default) SMS';
  readonly description = 'Sends SMS when order is completed (non-service5)';
  readonly triggerEvent = TriggerEvent.ORDER_COMPLETED;
  readonly toolType = ToolType.SMS;
  readonly defaultParameters = {
    delayMinutes: 0,
    message:
      'Hi {{contact.first_name}}, thanks for attending your session(s). Your order is now completed. — BetterLSAT',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { order } = eventData;
    if (!order?.customer?.phone) {return null;}
    const hasService5 =
      Array.isArray(order?.items) && order.items.some((i: any) => i.id === 5);
    if (hasService5) {return null;}
    const values: Record<string, string> = {
      'contact.first_name': order.customer.name?.split(' ')[0] || 'there',
    };
    let message: string = parameters.message || this.defaultParameters.message;
    for (const [k, v] of Object.entries(values))
      {message = message.replace(new RegExp(`{{${k}}}`, 'g'), v);}
    return {
      recipients: order.customer.phone,
      message,
      data: { orderId: order.id },
    };
  }
}
