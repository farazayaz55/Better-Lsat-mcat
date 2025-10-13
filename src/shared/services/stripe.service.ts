import { Injectable } from '@nestjs/common';
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

  async createCheckoutSession(
    ctx: RequestContext,
    sessionData: StripeCheckoutSessionData,
  ): Promise<Stripe.Checkout.Session> {
    this.logger.log(
      ctx,
      `Creating checkout session for customer: ${sessionData.customerEmail}`,
    );

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: sessionData.lineItems,
        mode: 'payment',
        customer_email: sessionData.customerEmail,
        success_url: sessionData.successUrl,
        cancel_url: sessionData.cancelUrl,
        metadata: sessionData.metadata,
      });

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
}
