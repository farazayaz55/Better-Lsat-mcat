import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { AppLogger } from '../logger/logger.service';
import { RequestContext } from '../request-context/request-context.dto';

export interface StripePaymentIntentData {
  amount: number; // Amount in cents
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface StripeCustomerData {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutSessionData {
  lineItems: Array<{
    price_data: {
      currency: string;
      product_data: {
        name: string;
        description?: string;
      };
      unit_amount: number; // Amount in cents
    };
    quantity: number;
  }>;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt?: number; // Unix timestamp for session expiration
  metadata?: Record<string, string>;
  automaticTax?: boolean; // Enable automatic tax calculation via Stripe Tax
}

export interface StripeRefundData {
  paymentIntentId: string;
  amount?: number; // Amount in cents, if not provided, full refund
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly logger: AppLogger) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2020-08-27',
    });
    this.logger.setContext(StripeService.name);
  }

  async createCustomer(
    ctx: RequestContext,
    customerData: StripeCustomerData,
  ): Promise<Stripe.Customer> {
    this.logger.log(
      ctx,
      `Creating Stripe customer for email: ${customerData.email}`,
    );

    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        metadata: customerData.metadata,
      });

      this.logger.log(ctx, `Stripe customer created with ID: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async createPaymentIntent(
    ctx: RequestContext,
    paymentData: StripePaymentIntentData,
  ): Promise<Stripe.PaymentIntent> {
    this.logger.log(
      ctx,
      `Creating payment intent for amount: ${paymentData.amount}`,
    );

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentData.amount,
        currency: paymentData.currency,
        customer: paymentData.customerId,
        metadata: paymentData.metadata,
        description: paymentData.description,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(
        ctx,
        `Payment intent created with ID: ${paymentIntent.id}`,
      );
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type
  mapStripeError(error: any) {
    // Log the full error for debugging

    // Map specific Stripe errors to user-friendly messages
    if (error?.code) {
      switch (error.code) {
        case 'card_declined': {
          return new BadRequestException(
            'Your card was declined. Please try a different payment method.',
          );
        }

        case 'expired_card': {
          return new BadRequestException(
            'Your card has expired. Please use a different card.',
          );
        }

        case 'incorrect_cvc': {
          return new BadRequestException(
            'The security code on your card is incorrect.',
          );
        }

        case 'insufficient_funds': {
          return new BadRequestException('Your card has insufficient funds.');
        }

        case 'processing_error': {
          return new ServiceUnavailableException(
            'Payment processing is temporarily unavailable. Please try again.',
          );
        }

        case 'rate_limit': {
          return new ServiceUnavailableException(
            'Too many requests. Please wait a moment and try again.',
          );
        }

        case 'authentication_required': {
          return new BadRequestException(
            'Additional authentication is required for this payment.',
          );
        }

        default: {
          return new InternalServerErrorException(
            'Payment service error. Please try again.',
          );
        }
      }
    }
  }

  async createCheckoutSession(
    ctx: RequestContext,
    sessionData: StripeCheckoutSessionData,
  ): Promise<Stripe.Checkout.Session> {
    this.logger.log(
      ctx,
      `Creating checkout session for customer: ${sessionData.customerEmail}`,
    );

    try {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: sessionData.lineItems,
        mode: 'payment',
        customer_email: sessionData.customerEmail,
        success_url: sessionData.successUrl,
        cancel_url: sessionData.cancelUrl,
        metadata: sessionData.metadata,
      };

      // Enable automatic tax calculation via Stripe Tax
      if (sessionData.automaticTax) {
        sessionConfig.automatic_tax = { enabled: true };
        sessionConfig.tax_id_collection = { enabled: true };
        this.logger.log(
          ctx,
          'Automatic tax calculation enabled for checkout session',
        );
      }

      // Add expiration if provided
      if (sessionData.expiresAt) {
        sessionConfig.expires_at = sessionData.expiresAt;
        this.logger.log(
          ctx,
          `Setting checkout session expiration to: ${new Date(sessionData.expiresAt * 1000).toISOString()}`,
        );
      }

      const session = await this.stripe.checkout.sessions.create(sessionConfig);

      this.logger.log(ctx, `Checkout session created with ID: ${session.id}`);
      return session;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async retrieveCheckoutSession(
    ctx: RequestContext,
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    this.logger.log(ctx, `Retrieving checkout session: ${sessionId}`);

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to retrieve checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async retrievePaymentIntent(
    ctx: RequestContext,
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    this.logger.log(ctx, `Retrieving payment intent: ${paymentIntentId}`);

    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to retrieve payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async confirmPaymentIntent(
    ctx: RequestContext,
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    this.logger.log(ctx, `Confirming payment intent: ${paymentIntentId}`);

    try {
      const paymentIntent =
        await this.stripe.paymentIntents.confirm(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to confirm payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async constructWebhookEvent(
    ctx: RequestContext,
    payload: string | Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    this.logger.log(ctx, 'Constructing webhook event');

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
      return event;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to construct webhook event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async retrieveCustomer(
    ctx: RequestContext,
    customerId: string,
  ): Promise<Stripe.Customer> {
    this.logger.log(ctx, `Retrieving customer: ${customerId}`);

    try {
      const customer = (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
      return customer;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to retrieve customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async listCustomersByEmail(
    ctx: RequestContext,
    email: string,
  ): Promise<Stripe.Customer[]> {
    this.logger.log(ctx, `Listing customers by email: ${email}`);

    try {
      const customers = await this.stripe.customers.list({
        email,
        limit: 1,
      });
      return customers.data;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to list customers by email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Create a refund for a payment intent
   */
  async createRefund(
    ctx: RequestContext,
    refundData: StripeRefundData,
  ): Promise<Stripe.Refund> {
    this.logger.log(
      ctx,
      `Creating refund for payment intent: ${refundData.paymentIntentId}`,
    );

    try {
      // First, retrieve the payment intent to get the charge ID
      const paymentIntent = await this.retrievePaymentIntent(
        ctx,
        refundData.paymentIntentId,
      );

      // Get the latest charge from the payment intent
      const latestCharge = (paymentIntent as any).latest_charge;
      if (!latestCharge) {
        throw new Error('No charge found for this payment intent');
      }

      const refund = await this.stripe.refunds.create({
        charge: latestCharge as string,
        amount: refundData.amount,
        reason: refundData.reason,
        metadata: refundData.metadata,
      });

      this.logger.log(ctx, `Refund created with ID: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create refund: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve a refund by ID
   */
  async retrieveRefund(
    ctx: RequestContext,
    refundId: string,
  ): Promise<Stripe.Refund> {
    this.logger.log(ctx, `Retrieving refund: ${refundId}`);

    try {
      const refund = await this.stripe.refunds.retrieve(refundId);
      return refund;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to retrieve refund: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * List refunds for a payment intent
   */
  async listRefunds(
    ctx: RequestContext,
    paymentIntentId: string,
  ): Promise<Stripe.Refund[]> {
    this.logger.log(
      ctx,
      `Listing refunds for payment intent: ${paymentIntentId}`,
    );

    try {
      const refunds = await this.stripe.refunds.list({
        payment_intent: paymentIntentId,
      });
      return refunds.data;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to list refunds: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve exchange rates from Stripe
   * Returns exchange rates with CAD as the base currency
   * Throws an error if exchange rates cannot be retrieved
   */
  async getExchangeRates(
    ctx: RequestContext,
    baseCurrency: string = 'CAD',
  ): Promise<any> {
    this.logger.log(
      ctx,
      `Retrieving exchange rates for base currency: ${baseCurrency}`,
    );

    try {
      // Use a public exchange rate API
      // exchangerate-api.com is free and doesn't require authentication
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`,
      );

      if (!response.ok) {
        throw new Error(`Exchange rate API returned ${response.status}`);
      }

      const data: any = await response.json();

      if (!data || !data.rates) {
        throw new Error('Invalid response from exchange rate API');
      }

      this.logger.log(
        ctx,
        `Successfully retrieved exchange rates for ${baseCurrency}`,
      );

      return {
        source: baseCurrency,
        rates: data.rates,
        effective_at: data.date
          ? new Date(data.date).getTime() / 1000
          : Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to retrieve exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error(
        `Exchange rates unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get currency conversion for a specific amount
   */
  async convertCurrency(
    ctx: RequestContext,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    this.logger.log(
      ctx,
      `Converting ${amount} from ${fromCurrency} to ${toCurrency}`,
    );

    try {
      // Get the exchange rate first
      const exchangeRates = await this.getExchangeRates(ctx, fromCurrency);

      if (!exchangeRates || !exchangeRates.rates) {
        throw new Error('No exchange rates available');
      }

      const rates = exchangeRates.rates;

      if (!rates[toCurrency]) {
        throw new Error(`Exchange rate not available for ${toCurrency}`);
      }

      const convertedAmount = amount * rates[toCurrency];

      this.logger.log(
        ctx,
        `Converted ${amount} ${fromCurrency} to ${convertedAmount} ${toCurrency}`,
      );

      return convertedAmount;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to convert currency: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
