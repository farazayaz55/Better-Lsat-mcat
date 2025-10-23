import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { StripeService } from '../../shared/services/stripe.service';
import { OrderRepository } from '../repository/order.repository';
import {
  PaymentStatus,
  StripeCheckoutSession,
  StripeMetadata,
  StripePaymentIntent,
} from '../interfaces/stripe-metadata.interface';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';

@Injectable()
export class PaymentService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly orderRepository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.logger.setContext(PaymentService.name);
  }

  /**
   * Update Stripe metadata for an order
   */
  async updateStripeMeta(
    ctx: RequestContext,
    orderId: number,
    stripeMeta: StripeMetadata,
  ): Promise<void> {
    this.logger.log(
      ctx,
      `Updating Stripe metadata for order ${orderId}: ${JSON.stringify(stripeMeta)}`,
    );

    await this.orderRepository.update(orderId, {
      stripe_meta: stripeMeta,
    });

    this.logger.log(
      ctx,
      `Successfully updated Stripe metadata for order ${orderId}`,
    );
  }

  /**
   * Atomically update both Stripe metadata and slot reservation status
   */
  async updatePaymentAndReservationStatus(
    ctx: RequestContext,
    orderId: number,
    stripeMeta: StripeMetadata,
    reservationStatus: SlotReservationStatus,
  ): Promise<void> {
    this.logger.log(
      ctx,
      `Atomically updating payment and reservation status for order ${orderId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update('Order', orderId, {
        stripe_meta: stripeMeta,
        slot_reservation_status: reservationStatus,
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        ctx,
        `Successfully atomically updated order ${orderId} with payment status and reservation status`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        ctx,
        `Failed to atomically update order ${orderId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create a Stripe checkout session for an order
   */
  async createStripeCheckoutSession(
    ctx: RequestContext,
    orderId: number,
  ): Promise<StripeCheckoutSession | undefined> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.error(ctx, `Order with ID ${orderId} not found`);
      return;
    }

    try {
      // Create checkout session
      const session = await this.stripeService.createCheckoutSession(ctx, {
        customerEmail: order.customer.email,
        lineItems: order.items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
            },
            unit_amount: item.price * 100, // Convert to cents
          },
          quantity: item.quantity,
        })),
        successUrl: `${this.configService.get('FRONTEND_URL')}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
        cancelUrl: `${this.configService.get('FRONTEND_URL')}/payment/cancel?order_id=${orderId}`,
        metadata: {
          orderId: orderId.toString(),
        },
      });

      // Update order with session ID
      await this.updateStripeMeta(ctx, orderId, {
        checkoutSessionId: session.url || undefined,
        paymentStatus: PaymentStatus.PENDING,
        lastWebhookProcessedAt: new Date(),
      });

      return {
        url: session.url!,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Stripe checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw this.stripeService.mapStripeError(error);
    }
  }

  /**
   * Create a Stripe payment intent for an order
   */
  async createStripePaymentIntent(
    ctx: RequestContext,
    orderId: number | undefined,
  ): Promise<StripePaymentIntent | undefined> {
    if (!orderId) {
      this.logger.error(ctx, 'Invalid order ID passed');
      return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      this.logger.error(ctx, `Order with ID ${orderId} not found`);
      return;
    }

    try {
      // Calculate total amount in cents
      const totalAmount = order.items.reduce((total, item) => {
        return total + item.price * item.quantity * 100; // Convert to cents
      }, 0);

      // Create Stripe customer if not exists
      const existingCustomers = await this.stripeService.listCustomersByEmail(
        ctx,
        order.customer.email,
      );

      const stripeCustomer =
        existingCustomers.length > 0
          ? existingCustomers[0]
          : await this.stripeService.createCustomer(ctx, {
              email: order.customer.email,
              name: order.customer.name,
            });

      // Create payment intent
      const paymentIntent = await this.stripeService.createPaymentIntent(ctx, {
        amount: totalAmount,
        currency: 'usd',
        customerId: stripeCustomer.id,
        metadata: {
          orderId: orderId.toString(),
        },
      });

      // Update order with payment intent ID
      await this.updateStripeMeta(ctx, orderId, {
        paymentIntentId: paymentIntent.id,
        paymentStatus: PaymentStatus.PENDING,
        lastWebhookProcessedAt: new Date(),
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw this.stripeService.mapStripeError(error);
    }
  }

  /**
   * Confirm a Stripe payment and update order status
   */
  async confirmStripePayment(
    ctx: RequestContext,
    paymentIntentId: string,
  ): Promise<boolean> {
    try {
      this.logger.log(
        ctx,
        `Confirming Stripe payment for payment intent: ${paymentIntentId}`,
      );

      const paymentIntent = await this.stripeService.retrievePaymentIntent(
        ctx,
        paymentIntentId,
      );

      if (paymentIntent.status === 'succeeded') {
        // Find order by payment intent ID
        const order = await this.orderRepository
          .createQueryBuilder('o')
          .where("o.stripe_meta->>'paymentIntentId' = :paymentIntentId", {
            paymentIntentId,
          })
          .getOne();

        if (order) {
          // Atomically update both payment status and reservation status
          await this.updatePaymentAndReservationStatus(
            ctx,
            order.id,
            {
              ...order.stripe_meta,
              paymentStatus: PaymentStatus.SUCCEEDED,
              lastWebhookProcessedAt: new Date(),
            },
            SlotReservationStatus.CONFIRMED,
          );

          this.logger.log(
            ctx,
            `Successfully confirmed payment for order ${order.id}`,
          );
          return true;
        } else {
          this.logger.warn(
            ctx,
            `Order not found for payment intent: ${paymentIntentId}`,
          );
          return false;
        }
      } else {
        this.logger.warn(
          ctx,
          `Payment intent ${paymentIntentId} status is ${paymentIntent.status}, not succeeded`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to confirm payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
