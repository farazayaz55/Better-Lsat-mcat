/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppLogger } from '../shared/logger/logger.service';
import { ReqContext } from '../shared/request-context/req-context.decorator';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { StripeService } from '../shared/services/stripe.service';
import { OrderService } from '../order/order.service';
import { GoogleCalendarService } from '../shared/services/google-calendar-api-key.service';
import { UserService } from '../user/services/user.service';
import { PaymentStatus } from '../order/interfaces/stripe-metadata.interface';
import { SlotReservationStatus } from '../order/constants/slot-reservation-status.constant';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly logger: AppLogger,
    private readonly stripeService: StripeService,
    private readonly orderService: OrderService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly userService: UserService,
  ) {
    this.logger.setContext(WebhookController.name);
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Stripe webhooks',
    description: 'Processes Stripe payment webhook events',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook processed' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid webhook signature or payload',
  })
  // eslint-disable-next-line max-statements
  public async handleStripeWebhook(
    @ReqContext() ctx: RequestContext,
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<void> {
    this.logger.log(ctx, '=== STRIPE WEBHOOK RECEIVED ===');
    this.logger.log(ctx, `Signature: ${signature ? 'Present' : 'Missing'}`);
    this.logger.log(ctx, `Raw body length: ${req.rawBody?.length || 0} bytes`);
    this.logger.log(ctx, `Raw body type: ${typeof req.rawBody}`);
    this.logger.log(ctx, `Raw body is Buffer: ${Buffer.isBuffer(req.rawBody)}`);
    this.logger.log(
      ctx,
      `Raw body is String: ${typeof req.rawBody === 'string'}`,
    );

    try {
      // Ensure we have a Buffer for Stripe signature verification
      const payload = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(req.rawBody || '', 'utf8');

      this.logger.log(ctx, `Payload type: ${typeof payload}`);
      this.logger.log(ctx, `Payload is Buffer: ${Buffer.isBuffer(payload)}`);
      this.logger.log(ctx, `Payload length: ${payload.length} bytes`);

      const event = await this.stripeService.constructWebhookEvent(
        ctx,
        payload,
        signature,
      );

      this.logger.log(ctx, `=== PROCESSING STRIPE EVENT ===`);
      this.logger.log(ctx, `Event type: ${event.type}`);
      this.logger.log(ctx, `Event ID: ${event.id}`);
      this.logger.log(ctx, `Event created: ${event.created}`);

      switch (event.type) {
        case 'checkout.session.completed': {
          this.logger.log(ctx, '=== HANDLING CHECKOUT SESSION COMPLETED ===');
          await this.handleCheckoutSessionCompleted(ctx, event);
          break;
        }
        case 'payment_intent.succeeded': {
          this.logger.log(ctx, '=== HANDLING PAYMENT INTENT SUCCEEDED ===');
          await this.handlePaymentIntentSucceeded(ctx, event);
          break;
        }
        case 'payment_intent.payment_failed': {
          this.logger.log(ctx, '=== HANDLING PAYMENT INTENT FAILED ===');
          await this.handlePaymentIntentFailed(ctx, event);
          break;
        }
        default: {
          this.logger.log(ctx, `=== UNHANDLED EVENT TYPE: ${event.type} ===`);
        }
      }

      this.logger.log(ctx, '=== WEBHOOK PROCESSING COMPLETED SUCCESSFULLY ===');
    } catch (error) {
      this.logger.error(ctx, `=== WEBHOOK ERROR ===`);
      this.logger.error(
        ctx,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.error(
        ctx,
        `Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`,
      );
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Catch-all POST route for debugging' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook debugging information',
    schema: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' },
        received: { type: 'boolean' },
        body: { type: 'object' },
        headers: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  public async catchAllPost(
    @ReqContext() ctx: RequestContext,
    @Body() body: any,
    @Headers() headers: any,
  ): Promise<any> {
    this.logger.log(ctx, '=== CATCH-ALL POST ROUTE HIT ===');
    this.logger.log(ctx, `Body: ${JSON.stringify(body)}`);
    this.logger.log(ctx, `Headers: ${JSON.stringify(headers)}`);
    this.logger.log(
      ctx,
      `Stripe-Signature: ${headers['stripe-signature'] || 'Missing'}`,
    );

    return {
      message: 'Catch-all route hit - check webhook URL configuration',
      received: true,
      body,
      headers: Object.keys(headers),
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook health check' })
  public async webhookHealthCheck(
    @ReqContext() ctx: RequestContext,
  ): Promise<any> {
    this.logger.log(ctx, '=== WEBHOOK HEALTH CHECK ===');
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Webhook endpoint is accessible',
    };
  }

  @Post('stripe/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test Stripe webhook without signature verification',
  })
  public async testStripeWebhook(
    @ReqContext() ctx: RequestContext,
    @Body() testEvent: any,
  ): Promise<any> {
    this.logger.log(ctx, 'Received test Stripe webhook');

    try {
      this.logger.log(ctx, `Processing test Stripe event: ${testEvent.type}`);

      switch (testEvent.type) {
        case 'checkout.session.completed': {
          await this.handleCheckoutSessionCompleted(ctx, testEvent);
          break;
        }
        case 'payment_intent.succeeded': {
          await this.handlePaymentIntentSucceeded(ctx, testEvent);
          break;
        }
        case 'payment_intent.payment_failed': {
          await this.handlePaymentIntentFailed(ctx, testEvent);
          break;
        }
        default: {
          this.logger.log(ctx, `Unhandled event type: ${testEvent.type}`);
        }
      }

      return { success: true, message: 'Test webhook processed successfully' };
    } catch (error) {
      this.logger.error(
        ctx,
        `Test webhook processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  // eslint-disable-next-line max-statements
  public async handleCheckoutSessionCompleted(
    ctx: RequestContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event: any,
  ): Promise<void> {
    const session = event.data.object;
    this.logger.log(ctx, `=== CHECKOUT SESSION COMPLETED ===`);
    this.logger.log(ctx, `Session ID: ${session.id}`);
    this.logger.log(ctx, `Session status: ${session.status}`);
    this.logger.log(ctx, `Session payment status: ${session.payment_status}`);
    this.logger.log(
      ctx,
      `Session metadata: ${JSON.stringify(session.metadata)}`,
    );

    // Extract order ID from metadata
    const orderId = session.metadata?.orderId;
    this.logger.log(ctx, `Extracted order ID from metadata: ${orderId}`);
    if (orderId) {
      try {
        this.logger.log(ctx, `Looking up order with ID: ${orderId}`);
        const order = await this.orderService.findOne(parseInt(orderId));
        this.logger.log(ctx, `Found order: ${order ? 'Yes' : 'No'}`);
        if (order) {
          this.logger.log(
            ctx,
            `Order details: ID=${order.id}, CustomerID=${order.customerId}, Items=${order.items?.length || 0}`,
          );
          // Validate slot reservation before confirming payment
          const reservationValid = await this.validateSlotReservation(
            ctx,
            order,
          );
          if (!reservationValid) {
            this.logger.error(
              ctx,
              `Order ${orderId} payment succeeded but slot reservation is no longer valid - initiating refund`,
            );
            // TODO: Implement refund logic here
            return;
          }
          // Update stripe_meta with completion information
          order.stripe_meta = {
            ...order.stripe_meta,
            checkoutSessionStatus: session.status,
            paymentStatus: PaymentStatus.SUCCEEDED,
            paymentCompletedAt: new Date(),
            lastWebhookEvent: 'checkout.session.completed',
            lastWebhookProcessedAt: new Date(),
          };

          await this.orderService.updateStripeMeta(order.id, order.stripe_meta);
          // Update slot reservation status to CONFIRMED
          await this.orderService.updateOrder(order.id, {
            slot_reservation_status: SlotReservationStatus.CONFIRMED,
          });

          this.logger.log(
            ctx,
            `Order ${orderId} payment completed via checkout session`,
          );

          // Create Google Calendar events for non-GHL items after successful payment
          await this.createGoogleCalendarEvents(ctx, order);
          this.logger.log(
            ctx,
            `=== GOOGLE CALENDAR EVENT CREATION COMPLETED ===`,
          );
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to update order ${orderId} after checkout completion: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  public async handlePaymentIntentSucceeded(
    ctx: RequestContext,
    event: any,
  ): Promise<void> {
    const paymentIntent = event.data.object;
    this.logger.log(ctx, `Payment intent succeeded: ${paymentIntent.id}`);

    // Extract order ID from metadata
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      try {
        const order = await this.orderService.findOne(parseInt(orderId));
        if (order) {
          // Validate slot reservation before confirming payment
          const reservationValid = await this.validateSlotReservation(
            ctx,
            order,
          );
          if (!reservationValid) {
            this.logger.error(
              ctx,
              `Order ${orderId} payment succeeded but slot reservation is no longer valid - initiating refund`,
            );
            // TODO: Implement refund logic here
            return;
          }
          // Update stripe_meta with payment intent information
          order.stripe_meta = {
            ...order.stripe_meta,
            paymentIntentId: paymentIntent.id,
            paymentIntentStatus: paymentIntent.status,
            paymentStatus: PaymentStatus.SUCCEEDED,
            paymentMethod: paymentIntent.payment_method,
            paymentCompletedAt: new Date(),
            lastWebhookEvent: 'payment_intent.succeeded',
            lastWebhookProcessedAt: new Date(),
          };

          await this.orderService.updateStripeMeta(order.id, order.stripe_meta);
          // Update slot reservation status to CONFIRMED
          await this.orderService.updateOrder(order.id, {
            slot_reservation_status: SlotReservationStatus.CONFIRMED,
          });
          // Update slot reservation status to CONFIRMED
          await this.orderService.updateOrder(order.id, {
            slot_reservation_status: SlotReservationStatus.CONFIRMED,
          });

          this.logger.log(
            ctx,
            `Order ${orderId} payment completed via payment intent`,
          );
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to update order ${orderId} after payment intent success: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  public async handlePaymentIntentFailed(
    ctx: RequestContext,
    event: any,
  ): Promise<void> {
    const paymentIntent = event.data.object;
    this.logger.log(ctx, `Payment intent failed: ${paymentIntent.id}`);

    // Extract order ID from metadata
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId) {
      try {
        const order = await this.orderService.findOne(parseInt(orderId));
        if (order) {
          // Update stripe_meta with failure information
          order.stripe_meta = {
            ...order.stripe_meta,
            paymentIntentId: paymentIntent.id,
            paymentIntentStatus: paymentIntent.status,
            paymentStatus: PaymentStatus.SUCCEEDED,
            paymentFailedAt: new Date(),
            lastWebhookEvent: 'payment_intent.payment_failed',
            lastWebhookProcessedAt: new Date(),
            webhookErrors: [
              ...(order.stripe_meta.webhookErrors || []),
              {
                eventType: 'payment_intent.payment_failed',
                error:
                  paymentIntent.last_payment_error?.message || 'Payment failed',
                timestamp: new Date(),
              },
            ],
          };

          await this.orderService.updateStripeMeta(order.id, order.stripe_meta);
          // Update slot reservation status to CONFIRMED
          await this.orderService.updateOrder(order.id, {
            slot_reservation_status: SlotReservationStatus.CONFIRMED,
          });
          // Update slot reservation status to CONFIRMED
          await this.orderService.updateOrder(order.id, {
            slot_reservation_status: SlotReservationStatus.CONFIRMED,
          });

          this.logger.log(ctx, `Order ${orderId} payment failed`);
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to update order ${orderId} after payment failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  public async createGoogleCalendarEvents(
    ctx: RequestContext,
    order: any,
  ): Promise<void> {
    try {
      this.logger.log(ctx, `=== CREATING GOOGLE CALENDAR EVENTS ===`);
      this.logger.log(
        ctx,
        `Order ID: ${order.id}, Customer ID: ${order.customerId}`,
      );
      this.logger.log(ctx, `Number of items: ${order.items?.length || 0}`);

      // Get customer email
      this.logger.log(
        ctx,
        `Getting customer details for ID: ${order.customerId}`,
      );
      const customer = await this.userService.getUserById(
        ctx,
        order.customerId,
      );
      const customerEmail = customer.email;
      this.logger.log(ctx, `Customer email: ${customerEmail}`);

      // Process each item in the order
      this.logger.log(ctx, `Processing ${order.items?.length || 0} items...`);
      for (const item of order.items) {
        this.logger.log(ctx, `Processing item: ${item.name} (ID: ${item.id})`);

        // Skip GHL items (ID 8) - they're handled separately
        if (item.id === 8) {
          this.logger.log(
            ctx,
            `Skipping Google Calendar event for GHL item ${item.name} (ID: ${item.id})`,
          );
          continue;
        }

        // Get employee email if assigned
        let employeeEmail: string | undefined;
        if (item.assignedEmployeeId) {
          try {
            const employee = await this.userService.getUserById(
              ctx,
              item.assignedEmployeeId,
            );
            employeeEmail = employee.email;
          } catch (error) {
            this.logger.warn(
              ctx,
              `Could not get employee email for ID ${item.assignedEmployeeId}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          }
        }

        this.logger.log(
          ctx,
          `Creating Google Calendar event for item ${item.name} (ID: ${item.id}) with employee email: ${employeeEmail || 'No employee assigned'}`,
        );

        // Create Google Calendar event
        await this.googleCalendarService.createAppointment(
          ctx,
          item,
          customerEmail,
          employeeEmail,
        );
      }

      this.logger.log(
        ctx,
        `Successfully created Google Calendar events for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar events for order ${order.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
  /**
   * Validates that the slot reservation is still valid before confirming payment
   * @param ctx Request context
   * @param order The order to validate
   * @returns true if reservation is valid, false if expired/invalid
   */
  private async validateSlotReservation(
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
        `Error validating slot reservation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
