import { Injectable } from '@nestjs/common';
import { BaseAutomation } from './base-automation';
import { TriggerEvent } from '../constants/trigger-events.constant';
import { ToolType } from '../constants/tool-types.constant';
import { ToolPayload } from '../tools/tool-payload.interface';
import { signRescheduleToken } from '../../shared/security/reschedule-token.util';

@Injectable()
export class NoShowEmailAutomation extends BaseAutomation {
  readonly key = 'no-show-email';
  readonly name = 'No-show Email';
  readonly description =
    'Sends email with reschedule link when appointment is a no-show';
  readonly triggerEvent = TriggerEvent.ORDER_APPOINTMENT_NO_SHOW;
  readonly toolType = ToolType.EMAIL;
  readonly defaultParameters = {
    delayMinutes: 0,
    template: 'no-show-email',
    subject: 'We missed you — reschedule your consultation',
    message:
      'Hi {{customerName}}, this is {{employeeName}} from BetterLSAT. Looks like we missed each other for your consultation today. No worries - here is the link to reschedule: {{rescheduleLink}}',
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    const { appointment } = eventData;
    const order = appointment?.order || appointment;
    const email = order?.customer?.email || order?.customerEmail;
    if (!email) {return null;}

    const token = signRescheduleToken({
      appointmentId: appointment.id,
      orderId: appointment.orderId,
      itemId: appointment.itemId,
    });
    const base = process.env.RESCHEDULE_BASE_URL || '';
    const rescheduleLink = `${base.replace(/\/$/, '')}/reschedule?token=${token}`;

    // Extract customer first name
    const customerName =
      order?.customer?.name?.split(' ')[0] || order?.customer?.name || 'there';
    const fullCustomerName = order?.customer?.name || customerName;

    // Get employee name if available, otherwise default
    const employeeName = 'our team'; // Could be enhanced to get actual employee name

    // Format appointment date for display
    const appointmentDate = appointment?.slotDateTime
      ? new Date(appointment.slotDateTime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : null;

    // Get template name - prefer stored config, fallback to default
    const templateName = parameters.template || this.defaultParameters.template;

    // Replace placeholders in subject and message (for fallback)
    const subject = this.replacePlaceholders(
      parameters.subject || this.defaultParameters.subject,
      {
        customerName,
        employeeName,
        rescheduleLink,
      },
    );

    const message = this.replacePlaceholders(
      parameters.message || this.defaultParameters.message,
      {
        customerName,
        employeeName,
        rescheduleLink,
      },
    );

    const payload: ToolPayload = {
      recipients: email,
      subject,
      template: templateName, // Always include template
      data: {
        customerName: fullCustomerName,
        employeeName,
        rescheduleLink,
        appointmentId: appointment.id,
        appointmentDate,
        orderNumber: order?.id || appointment?.orderId,
      },
      message, // Fallback plain text
    };

    // Use AppLogger instead of console.log for better integration
    // console.log(`[NoShowEmailAutomation] Built payload with template: ${templateName}`);
    // console.log(`[NoShowEmailAutomation] Payload:`, JSON.stringify(payload, null, 2));

    return payload;
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
