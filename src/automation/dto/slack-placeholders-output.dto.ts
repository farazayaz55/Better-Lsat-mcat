import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SlackPlaceholderOutputDto {
  @ApiProperty({
    description: 'Placeholder name without double braces',
    example: 'orderId',
  })
  placeholder: string;

  @ApiProperty({
    description: 'Human-readable description of what this placeholder represents',
    example: 'Order ID',
  })
  description: string;

  @ApiProperty({
    description: 'Example value for this placeholder',
    example: '123',
  })
  example: string;
}

export class SlackPlaceholdersResponseDto {
  @ApiProperty({
    description: 'Array of available placeholders for Slack automation messages',
    type: [SlackPlaceholderOutputDto],
  })
  placeholders: SlackPlaceholderOutputDto[];

  @ApiPropertyOptional({
    description: 'Usage example showing how to use placeholders in messages',
    example:
      'Use {{orderId}} in your message template like: "New order #{{orderId}} from {{customerName}}"',
  })
  example?: string;
}

