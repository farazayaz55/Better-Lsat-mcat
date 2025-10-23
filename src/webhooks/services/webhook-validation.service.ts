import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';

@Injectable()
export class WebhookValidationService {
  private readonly logger = new Logger(WebhookValidationService.name);

  /**
   * Validates that the slot reservation is still valid before confirming payment
   * @param ctx Request context
   * @param order The order to validate
   * @returns true if reservation is valid, false if expired/invalid
   */
  async validateSlotReservation(
    ctx: RequestContext,
    order: any,
  ): Promise<boolean> {
    try {
      this.logger.log(ctx, `Validating slot reservation for order ${order.id}`);

      // Check if order has reservation data
      if (
        !order.slot_reservation_expires_at ||
        !order.slot_reservation_status
      ) {
        this.logger.warn(
          ctx,
          `Order ${order.id} has no slot reservation data - treating as valid (legacy order)`,
        );
        return true; // Legacy orders without reservation data are valid
      }

      // Check if reservation has expired
      const now = new Date();
      if (order.slot_reservation_expires_at < now) {
        this.logger.error(
          ctx,
          `Order ${order.id} slot reservation expired at ${order.slot_reservation_expires_at.toISOString()}`,
        );
        return false;
      }

      // Check if reservation status is still RESERVED
      if (order.slot_reservation_status !== SlotReservationStatus.RESERVED) {
        this.logger.error(
          ctx,
          `Order ${order.id} slot reservation status is ${order.slot_reservation_status}, expected RESERVED`,
        );
        return false;
      }

      this.logger.log(
        ctx,
        `Order ${order.id} slot reservation is valid until ${order.slot_reservation_expires_at.toISOString()}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error validating slot reservation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  /**
   * Validates payment intent data
   * @param ctx Request context
   * @param paymentIntent The payment intent object
   * @returns true if valid, false otherwise
   */
  async validatePaymentIntent(
    ctx: RequestContext,
    paymentIntent: any,
  ): Promise<boolean> {
    try {
      this.logger.log(ctx, `Validating payment intent: ${paymentIntent.id}`);

      // Check if payment intent has required fields
      if (!paymentIntent.id || !paymentIntent.status) {
        this.logger.error(
          ctx,
          `Payment intent missing required fields: ${JSON.stringify(paymentIntent)}`,
        );
        return false;
      }

      // Check if order ID exists in metadata
      if (!paymentIntent.metadata?.orderId) {
        this.logger.error(
          ctx,
          `Payment intent ${paymentIntent.id} missing orderId in metadata`,
        );
        return false;
      }

      this.logger.log(
        ctx,
        `Payment intent ${paymentIntent.id} validation passed`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error validating payment intent: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }

  /**
   * Validates checkout session data
   * @param ctx Request context
   * @param session The checkout session object
   * @returns true if valid, false otherwise
   */
  async validateCheckoutSession(
    ctx: RequestContext,
    session: any,
  ): Promise<boolean> {
    try {
      this.logger.log(ctx, `Validating checkout session: ${session.id}`);

      // Check if session has required fields
      if (!session.id || !session.status) {
        this.logger.error(
          ctx,
          `Checkout session missing required fields: ${JSON.stringify(session)}`,
        );
        return false;
      }

      // Check if order ID exists in metadata
      if (!session.metadata?.orderId) {
        this.logger.error(
          ctx,
          `Checkout session ${session.id} missing orderId in metadata`,
        );
        return false;
      }

      this.logger.log(ctx, `Checkout session ${session.id} validation passed`);
      return true;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error validating checkout session: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return false;
    }
  }
}
