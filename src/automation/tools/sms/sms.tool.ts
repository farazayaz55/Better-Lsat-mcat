import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { BaseTool } from '../base-tool';
import { ToolType } from '../../constants/tool-types.constant';
import { ToolPayload } from '../tool-payload.interface';
import { AppLogger } from '../../../shared/logger/logger.service';

@Injectable()
export class SmsTool extends BaseTool {
  readonly toolType = ToolType.SMS;
  readonly name = 'SMS';
  readonly description = 'Send SMS messages via Twilio';

  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private configService: ConfigService,
    private logger: AppLogger,
  ) {
    super();
    this.logger.setContext(SmsTool.name);
    this.initializeTwilioClient();
  }

  private initializeTwilioClient(): void {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        {
          requestID: 'twilio-init',
          url: '',
          ip: '',
          user: null,
        },
        'SMS tool not fully configured - Twilio credentials missing',
      );
      return;
    }

    this.twilioClient = twilio(accountSid, authToken);
  }

  async send(payload: ToolPayload): Promise<void> {
    if (!this.twilioClient) {
      this.logger.error(
        {
          requestID: 'sms-send',
          url: '',
          ip: '',
          user: null,
        },
        'Cannot send SMS: Twilio client not initialized',
      );
      throw new Error('Twilio client not configured');
    }

    const fromNumber = this.configService.get('TWILIO_PHONE_NUMBER');
    if (!fromNumber) {
      this.logger.error(
        {
          requestID: 'sms-send',
          url: '',
          ip: '',
          user: null,
        },
        'Cannot send SMS: TWILIO_PHONE_NUMBER not configured',
      );
      throw new Error('Twilio phone number not configured');
    }

    try {
      const recipients = Array.isArray(payload.recipients)
        ? payload.recipients
        : [payload.recipients];

      // Message should already have placeholders replaced by the automation
      // But let's do the replacement here to ensure it works
      let message = payload.message;

      // Always replace placeholders using the data object
      if (payload.data && Object.keys(payload.data).length > 0) {
        message = this.replacePlaceholders(message, payload.data);
      }

      this.logger.log(
        {
          requestID: 'sms-send',
          url: '',
          ip: '',
          user: null,
        },
        `SMS message to send: ${message.substring(0, 200)}`,
      );

      // Send SMS to each recipient
      for (const recipient of recipients) {
        // Skip if recipient is empty or invalid
        if (!recipient || typeof recipient !== 'string') {
          this.logger.warn(
            {
              requestID: 'sms-send',
              url: '',
              ip: '',
              user: null,
            },
            `Skipping invalid recipient: ${recipient}`,
          );
          continue;
        }

        await this.twilioClient.messages.create({
          body: message,
          from: fromNumber,
          to: recipient,
        });

        this.logger.log(
          {
            requestID: 'sms-send',
            url: '',
            ip: '',
            user: null,
          },
          `SMS sent successfully to ${recipient}`,
        );
      }
    } catch (error) {
      this.logger.error(
        {
          requestID: 'sms-send',
          url: '',
          ip: '',
          user: null,
        },
        `Failed to send SMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private replacePlaceholders(
    template: string,
    values: Record<string, string | number>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      const stringValue = value?.toString() || '';
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), stringValue);
    }
    return result;
  }

  isConfigured(): boolean {
    return !!(
      this.configService.get('TWILIO_ACCOUNT_SID') &&
      this.configService.get('TWILIO_AUTH_TOKEN') &&
      this.configService.get('TWILIO_PHONE_NUMBER')
    );
  }
}
