import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';

@Injectable()
export class OrderCompletedService5SmsAutomation extends BaseAutomation {
  readonly key = 'order-completed-service5-sms';
  readonly name = 'Order Completed (Service 5) SMS';
  readonly description = 'Sends SMS when order completed for service 5';
  readonly triggerEvent = TriggerEvent.ORDER_COMPLETED;
  readonly toolType = ToolType.SMS;
  readonly defaultParameters = {
    delayMinutes: 0,
    message:
      'Hi {{contact.first_name}}, your 15‑minute consult is completed. If you need anything else, reply here. — BetterLSAT',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { order } = eventData;
    if (!order?.customer?.phone) {return null;}
    const hasService5 =
      Array.isArray(order?.items) && order.items.some((i: any) => i.id === 5);
    if (!hasService5) {return null;}
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
