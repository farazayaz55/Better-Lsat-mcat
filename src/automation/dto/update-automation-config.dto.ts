import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class SlackAutomationParameters {
  @ApiPropertyOptional({
    description: 'Delay in minutes before executing (0 for immediate)',
    example: 0,
  })
  delayMinutes?: number;

  @ApiPropertyOptional({
    description: 'Slack channel to send notification to',
    example: '#orders',
  })
  channel?: string;

  @ApiPropertyOptional({
    description:
      'Custom message text with placeholders. Available: {{orderId}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}}, {{itemCount}}',
    example: '🎉 New order #{{orderId}} from {{customerName}} - ${{total}}',
  })
  customMessage?: string;

  @ApiPropertyOptional({
    description:
      'Custom block title with placeholders. Available: {{orderId}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}}, {{itemCount}}',
    example: 'New Order #{{orderId}}',
  })
  customBlockMessage?: string;
}

export class EmailAutomationParameters {
  @ApiPropertyOptional({
    description: 'Delay in minutes before executing (0 for immediate)',
    example: 0,
  })
  delayMinutes?: number;

  @ApiPropertyOptional({
    description: 'Additional CC recipients (email addresses)',
    example: ['manager@example.com'],
  })
  ccRecipients?: string[];

  @ApiPropertyOptional({
    description:
      'Email subject line with placeholders. Available: {{orderNumber}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}} (always CAD), {{itemCount}}, {{orderDate}}',
    example: 'Order #{{orderNumber}} Confirmed - Better LSAT MCAT',
  })
  subject?: string;

  @ApiPropertyOptional({
    description:
      'Email message body (fallback plain text) with placeholders. Available: {{orderNumber}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}} (always CAD), {{itemCount}}, {{orderDate}}',
    example:
      'Your order #{{orderNumber}} has been confirmed. Total: ${{total}}',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Template name to use for HTML rendering',
    example: 'order-confirmation',
  })
  template?: string;
}

export class UpdateAutomationConfigDto {
  @ApiPropertyOptional({
    description: 'Enable or disable the automation',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Configuration parameters for the automation. For Slack automations, available placeholders: {{orderId}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}}, {{itemCount}}. For Email automations, available placeholders: {{orderNumber}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}}, {{itemCount}}, {{orderDate}}',
    example: {
      delayMinutes: 0,
      channel: '#orders',
      customMessage:
        '🎉 New order #{{orderId}} from {{customerName}} - ${{total}}',
      customBlockMessage: 'New Order #{{orderId}}',
    },
  })
  @IsOptional()
  @IsObject()
  parameters?:
    | Record<string, unknown>
    | SlackAutomationParameters
    | EmailAutomationParameters;
}
