import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';
import { signRescheduleToken } from '../../shared/security/reschedule-token.util';

@Injectable()
export class NoShowSmsAutomation extends BaseAutomation {
  readonly key = 'no-show-sms';
  readonly name = 'No-show SMS';
  readonly description =
    'Sends SMS with reschedule link when appointment is a no-show';
  readonly triggerEvent = TriggerEvent.ORDER_APPOINTMENT_NO_SHOW;
  readonly toolType = ToolType.SMS;
  readonly defaultParameters = {
    delayMinutes: 0,
    message:
      'Hi {{contact.first_name}}, this is {{employee.name}} from BetterLSAT. Looks like we missed each other for your consultation today. No worries — here’s the link to reschedule: {{appointment.reschedule_link}}',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { appointment, ctx } = eventData;
    const order = appointment?.order || appointment; // appointment may not contain relations; placeholders best-effort
    const customerPhone = order?.customer?.phone || order?.customerPhone;
    if (!customerPhone) {return null;}

    const token = signRescheduleToken({
      appointmentId: appointment.id,
      orderId: appointment.orderId,
      itemId: appointment.itemId,
    });
    const base = process.env.RESCHEDULE_BASE_URL || '';
    const rescheduleLink = `${base.replace(/\/$/, '')}/reschedule?token=${token}`;

    const values: Record<string, string> = {
      'contact.first_name': order?.customer?.name?.split(' ')[0] || 'there',
      'employee.name': 'our team',
      'appointment.reschedule_link': rescheduleLink,
    };

    const template: string =
      parameters.message || this.defaultParameters.message;
    let message = template;
    for (const [key, value] of Object.entries(values)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return {
      recipients: customerPhone,
      message,
      data: { appointmentId: appointment.id, rescheduleLink },
    };
  }
}
