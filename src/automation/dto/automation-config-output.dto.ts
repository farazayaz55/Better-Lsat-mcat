import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ToolType } from '../constants/tool-types.constant';
import { TriggerEvent } from '../constants/trigger-events.constant';

export class AutomationConfigOutputDto {
  @ApiProperty({
    description: 'Unique identifier for the automation',
    example: 'slack-new-order',
  })
  key: string;

  @ApiProperty({
    description: 'Display name of the automation',
    example: 'Slack New Order Notification',
  })
  name: string;

  @ApiProperty({
    description: 'Detailed description of what the automation does',
    example: 'Sends Slack notification when new order is created',
  })
  description: string;

  @ApiProperty({
    enum: TriggerEvent,
    description: 'Event that triggers this automation',
    example: TriggerEvent.ORDER_CREATED,
  })
  triggerEvent: string;

  @ApiProperty({
    enum: ToolType,
    description: 'Communication tool used for this automation',
    example: ToolType.EMAIL,
  })
  toolType: string;

  @ApiProperty({
    description: 'Whether the automation is enabled',
    example: true,
  })
  isEnabled: boolean;

  @ApiPropertyOptional({
    description: 'Configuration parameters for the automation',
    example: {
      delayMinutes: 0,
      channel: '#orders',
    },
  })
  parameters?: Record<string, any>;
}
