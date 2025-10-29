import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BaseTool } from '../base-tool';
import { ToolType } from '../../constants/tool-types.constant';
import { ToolPayload } from '../tool-payload.interface';

@Injectable()
export class SlackTool extends BaseTool {
  readonly toolType = ToolType.SLACK;
  readonly name = 'Slack';
  readonly description = 'Send messages to Slack channels';

  private readonly logger = new Logger(SlackTool.name);

  constructor(private configService: ConfigService) {
    super();
  }

  async send(payload: ToolPayload): Promise<void> {
    const webhookUrl = this.configService.get('SLACK_WEBHOOK_URL');

    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    try {
      // Construct Slack message payload
      const slackPayload: any = {
        text: payload.message,
      };

      // Add blocks if provided (rich formatting)
      if (payload.data?.blocks) {
        slackPayload.blocks = payload.data.blocks;
      }

      // Add channel if specified
      if (payload.channel) {
        slackPayload.channel = payload.channel;
      }

      await axios.post(webhookUrl, slackPayload);
      this.logger.log(`Slack message sent successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to send Slack message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.configService.get('SLACK_WEBHOOK_URL');
  }
}
