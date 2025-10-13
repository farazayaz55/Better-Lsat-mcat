export interface StripeMetadata {
  // Checkout Session Information
  checkoutSessionId?: string;
  checkoutSessionStatus?: string;
  checkoutSessionUrl?: string;

  // Payment Intent Information
  paymentIntentId?: string;
  paymentIntentStatus?: string;
  paymentIntentClientSecret?: string;

  // Payment Information
  paymentStatus?: 'pending' | 'succeeded' | 'failed' | 'canceled';
  paymentMethod?: string;
  amountPaid?: number;
  currency?: string;

  // Customer Information
  stripeCustomerId?: string;

  // Timestamps
  paymentCompletedAt?: Date;
  paymentFailedAt?: Date;

  // Additional metadata
  lastWebhookEvent?: string;
  lastWebhookProcessedAt?: Date;

  // Redirect URLs
  successUrl?: string;
  cancelUrl?: string;

  // Error tracking
  webhookErrors?: Array<{
    eventType: string;
    error: string;
    timestamp: Date;
  }>;
}
