import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { OrderService } from '../../order/services/order.service';
import { PaymentService } from '../../order/services/payment.service';
import { GoogleCalendarAppointmentService } from '../../shared/services/google-calendar/google-calendar-appointment.service';
import { UserService } from '../../user/services/user.service';
import {
  PaymentStatus,
  StripeMetadata,
} from '../../order/interfaces/stripe-metadata.interface';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';
import { Order } from '../../order/entities/order.entity';

interface StripeWebhookEvent {
  data: {
    object: StripeCheckoutSession | StripePaymentIntent;
  };
}

interface StripeCheckoutSession {
  id: string;
  status: string;
  payment_status: string;
  metadata?: {
    orderId?: string;
  };
}

interface StripePaymentIntent {
  id: string;
  status: string;
  payment_method?: string;
  last_payment_error?: {
    message?: string;
  };
  metadata?: {
    orderId?: string;
  };
}

@Injectable()
export class StripeWebhookHandlerService {
  private readonly logger = new Logger(StripeWebhookHandlerService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly googleCalendarAppointmentService: GoogleCalendarAppointmentService,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Builds Stripe metadata for checkout session completion
   */
  private buildCheckoutSessionMetadata(
    existingMeta: StripeMetadata,
    session: StripeCheckoutSession,
  ): StripeMetadata {
    return {
      ...existingMeta,
      checkoutSessionStatus: session.status,
      paymentStatus: PaymentStatus.SUCCEEDED,
      paymentCompletedAt: new Date(),
      lastWebhookEvent: 'checkout.session.completed',
      lastWebhookProcessedAt: new Date(),
    };
  }

  /**
   * Builds Stripe metadata for payment intent success
   */
  private buildPaymentIntentSuccessMetadata(
    existingMeta: StripeMetadata,
    paymentIntent: StripePaymentIntent,
  ): StripeMetadata {
    return {
      ...existingMeta,
      paymentIntentId: paymentIntent.id,
      paymentIntentStatus: paymentIntent.status,
      paymentStatus: PaymentStatus.SUCCEEDED,
      paymentMethod: paymentIntent.payment_method,
      paymentCompletedAt: new Date(),
      lastWebhookEvent: 'payment_intent.succeeded',
      lastWebhookProcessedAt: new Date(),
    };
  }

  /**
   * Builds Stripe metadata for payment intent failure
   */
  private buildPaymentIntentFailureMetadata(
    existingMeta: StripeMetadata,
    paymentIntent: StripePaymentIntent,
  ): StripeMetadata {
    return {
      ...existingMeta,
      paymentIntentId: paymentIntent.id,
      paymentIntentStatus: paymentIntent.status,
      paymentStatus: PaymentStatus.FAILED,
      paymentFailedAt: new Date(),
      lastWebhookEvent: 'payment_intent.payment_failed',
      lastWebhookProcessedAt: new Date(),
      webhookErrors: [
        ...(existingMeta.webhookErrors || []),
        {
          eventType: 'payment_intent.payment_failed',
          error: paymentIntent.last_payment_error?.message || 'Payment failed',
          timestamp: new Date(),
        },
      ],
    };
  }

  /**
   * Logs webhook event details
   */
  private logWebhookEvent(
    ctx: RequestContext,
    eventType: string,
    details: Record<string, unknown>,
  ): void {
    this.logger.log(ctx, `=== ${eventType} ===`);
    for (const [key, value] of Object.entries(details)) {
      this.logger.log(ctx, `${key}: ${JSON.stringify(value)}`);
    }
  }

  /**
   * Executes order processing within a database transaction
   */
  private async executeOrderProcessingTransaction<T>(
    ctx: RequestContext,
    orderId: string,
    processor: (order: Order) => Promise<T>,
  ): Promise<T | null> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.orderService.findOne(parseInt(orderId));
      if (!order) {
        this.logger.warn(ctx, `Order with ID ${orderId} not found`);
        await queryRunner.rollbackTransaction();
        return null;
      }

      const result = await processor(order);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        ctx,
        `Failed to process order ${orderId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Handles checkout session completed webhook
   */
  async handleCheckoutSessionCompleted(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const session = event.data.object as StripeCheckoutSession;
    this.logWebhookEvent(ctx, 'CHECKOUT SESSION COMPLETED', {
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      metadata: session.metadata,
    });

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(ctx, 'No order ID found in checkout session metadata');
      return;
    }

    await this.executeOrderProcessingTransaction(
      ctx,
      orderId,
      async (order) => {
        this.logger.log(
          ctx,
          `Processing checkout completion for order ${order.id}`,
        );

        const updatedStripeMeta = this.buildCheckoutSessionMetadata(
          order.stripe_meta,
          session,
        );

        await this.paymentService.updatePaymentAndReservationStatus(
          ctx,
          order.id,
          updatedStripeMeta,
          SlotReservationStatus.CONFIRMED,
        );

        await this.createGoogleCalendarEvents(ctx, order);

        this.logger.log(
          ctx,
          `Successfully processed checkout completion for order ${orderId}`,
        );
      },
    );
  }

  /**
   * Handles payment intent succeeded webhook
   */
  async handlePaymentIntentSucceeded(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as StripePaymentIntent;
    this.logger.log(ctx, `Payment intent succeeded: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(ctx, 'No order ID found in payment intent metadata');
      return;
    }

    await this.executeOrderProcessingTransaction(
      ctx,
      orderId,
      async (order) => {
        const updatedStripeMeta = this.buildPaymentIntentSuccessMetadata(
          order.stripe_meta,
          paymentIntent,
        );

        await this.paymentService.updatePaymentAndReservationStatus(
          ctx,
          order.id,
          updatedStripeMeta,
          SlotReservationStatus.CONFIRMED,
        );

        this.logger.log(
          ctx,
          `Successfully processed payment intent success for order ${orderId}`,
        );
      },
    );
  }

  /**
   * Handles payment intent failed webhook
   */
  async handlePaymentIntentFailed(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as StripePaymentIntent;
    this.logger.log(ctx, `Payment intent failed: ${paymentIntent.id}`);

    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(ctx, 'No order ID found in payment intent metadata');
      return;
    }

    await this.executeOrderProcessingTransaction(
      ctx,
      orderId,
      async (order) => {
        const updatedStripeMeta = this.buildPaymentIntentFailureMetadata(
          order.stripe_meta,
          paymentIntent,
        );

        await this.paymentService.updatePaymentAndReservationStatus(
          ctx,
          order.id,
          updatedStripeMeta,
          SlotReservationStatus.FAILED,
        );

        this.logger.log(
          ctx,
          `Successfully processed payment intent failure for order ${orderId}`,
        );
      },
    );
  }

  /**
   * Creates Google Calendar events for an order
   */
  private async createGoogleCalendarEvents(
    ctx: RequestContext,
    order: Order,
  ): Promise<void> {
    // Delegate to GoogleCalendarAppointmentService for better separation of concerns
    await this.googleCalendarAppointmentService.createOrderEvents(
      ctx,
      order,
      this.userService,
    );
  }
}
