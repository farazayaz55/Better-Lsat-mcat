import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export class StripeMetadata {
  @ApiPropertyOptional({
    description: 'Stripe checkout session ID',
    example: 'cs_test_123456789',
    type: 'string',
  })
  checkoutSessionId?: string;

  @ApiPropertyOptional({
    description: 'Stripe checkout session status',
    example: 'complete',
    type: 'string',
  })
  checkoutSessionStatus?: string;

  @ApiPropertyOptional({
    description: 'Stripe checkout session URL',
    example: 'https://checkout.stripe.com/pay/cs_test_123456789',
    type: 'string',
  })
  checkoutSessionUrl?: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent ID',
    example: 'pi_123456789',
    type: 'string',
  })
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent status',
    example: 'succeeded',
    type: 'string',
  })
  paymentIntentStatus?: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent client secret',
    example: 'pi_123456789_secret_abcdef',
    type: 'string',
  })
  paymentIntentClientSecret?: string;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCEEDED,
    type: 'string',
  })
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment method used',
    example: 'card',
    type: 'string',
  })
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Amount paid in cents',
    example: 5000,
    type: 'number',
  })
  amountPaid?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'usd',
    type: 'string',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Stripe customer ID',
    example: 'cus_123456789',
    type: 'string',
  })
  stripeCustomerId?: string;

  @ApiPropertyOptional({
    description: 'Payment completion timestamp',
    example: '2024-01-15T14:30:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  paymentCompletedAt?: Date;

  @ApiPropertyOptional({
    description: 'Payment failure timestamp',
    example: '2024-01-15T14:30:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  paymentFailedAt?: Date;

  @ApiPropertyOptional({
    description: 'Last webhook event processed',
    example: 'payment_intent.succeeded',
    type: 'string',
  })
  lastWebhookEvent?: string;

  @ApiPropertyOptional({
    description: 'Last webhook processing timestamp',
    example: '2024-01-15T14:30:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  lastWebhookProcessedAt?: Date;

  @ApiPropertyOptional({
    description: 'Success redirect URL',
    example: 'https://example.com/success',
    type: 'string',
  })
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'Cancel redirect URL',
    example: 'https://example.com/cancel',
    type: 'string',
  })
  cancelUrl?: string;

  @ApiPropertyOptional({
    description: 'Webhook processing errors',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        eventType: { type: 'string', example: 'payment_intent.succeeded' },
        error: { type: 'string', example: 'Invalid signature' },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-15T14:30:00.000Z',
        },
      },
    },
  })
  webhookErrors?: Array<{
    eventType: string;
    error: string;
    timestamp: Date;
  }>;
}

export class StripeCheckoutSession {
  @ApiProperty({
    description: 'Stripe checkout session URL for payment processing',
    example: 'https://checkout.stripe.com/pay/cs_test_123456789',
    type: 'string',
  })
  url: string;

  @ApiProperty({
    description: 'Stripe checkout session ID',
    example: 'cs_test_123456789',
    type: 'string',
  })
  sessionId: string;
}

export class StripePaymentIntent {
  @ApiProperty({
    description:
      'Stripe payment intent client secret for frontend confirmation',
    example: 'pi_123456789_secret_abcdef',
    type: 'string',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'Stripe payment intent ID',
    example: 'pi_123456789',
    type: 'string',
  })
  paymentIntentId: string;
}
