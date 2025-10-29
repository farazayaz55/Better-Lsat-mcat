import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { OrderService } from '../../order/services/order.service';
import { OrderRepository } from '../../order/repository/order.repository';
import { PaymentService } from '../../order/services/payment.service';
import { GoogleCalendarAppointmentService } from '../../shared/services/google-calendar/google-calendar-appointment.service';
import { UserService } from '../../user/services/user.service';
import { RefundService } from '../../finance/services/refund.service';
import { PaymentTransactionService } from '../../finance/services/payment-transaction.service';
import { InvoiceGeneratorService } from '../../invoicing/services/invoice-generator.service';
import { InvoiceService } from '../../invoicing/services/invoice.service';
import { InvoiceStatus } from '../../invoicing/constants/invoice-status.constant';
import {
  RefundStatus,
  RefundReason,
  TransactionType,
} from '../../finance/constants/finance.constant';
import {
  PaymentStatus,
  StripeMetadata,
} from '../../order/interfaces/stripe-metadata.interface';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';
import { Order } from '../../order/entities/order.entity';
import { StripeService } from '../../shared/services/stripe.service';
import { TriggerEvent } from '../../automation/constants/trigger-events.constant';

interface StripeCheckoutSession {
  id: string;
  status: string;
  payment_status: string;
  url?: string;
  currency?: string;
  metadata?: {
    orderId?: string;
    paidCurrency?: string; // Original currency user paid in
  };
  total_details?: {
    amount_tax?: number;
  };
  amount_subtotal?: number;
  amount_total?: number;
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
    private readonly orderRepository: OrderRepository,
    private readonly paymentService: PaymentService,
    private readonly googleCalendarAppointmentService: GoogleCalendarAppointmentService,
    private readonly userService: UserService,
    private readonly refundService: RefundService,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly invoiceGeneratorService: InvoiceGeneratorService,
    private readonly invoiceService: InvoiceService,
    private readonly stripeService: StripeService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Builds Stripe metadata for checkout session completion
   * All amounts stored in CAD, currency always CAD
   */
  private buildCheckoutSessionMetadata(
    existingMeta: StripeMetadata,
    session: StripeCheckoutSession,
  ): StripeMetadata {
    // Log session details for debugging
    this.logger.log(
      { user: null, requestID: 'webhook', url: '/webhook', ip: '127.0.0.1' },
      `Session details - ID: ${session.id}, URL: ${session.url}, Status: ${session.status}, Currency: ${session.currency}`,
    );

    // Extract tax information if available (in original payment currency)
    const taxAmount = session.total_details?.amount_tax || 0;
    const amountSubtotal = session.amount_subtotal || 0;
    const amountTotal = session.amount_total || 0;
    const paidCurrency = session.currency?.toUpperCase() || 'CAD';

    this.logger.log(
      { user: null, requestID: 'webhook', url: '/webhook', ip: '127.0.0.1' },
      `Tax details - Tax Amount: ${taxAmount}, Subtotal: ${amountSubtotal}, Total: ${amountTotal}, Currency: ${paidCurrency}`,
    );

    return {
      ...existingMeta,
      checkoutSessionId: session.id,
      checkoutSessionUrl: session.url || undefined,
      checkoutSessionStatus: session.status,
      paymentStatus: PaymentStatus.SUCCEEDED,
      paymentCompletedAt: new Date(),
      lastWebhookEvent: 'checkout.session.completed',
      lastWebhookProcessedAt: new Date(),
      // Store amounts in CAD - they will be converted when creating invoices/transactions
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      totalAmountIncludingTax: amountTotal > 0 ? amountTotal : undefined,
      amountPaid: amountSubtotal,
      currency: 'cad', // Always CAD
      paidCurrency, // Track what currency customer actually paid in
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

    const result = await this.executeOrderProcessingTransaction(
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

        // Generate invoice for the order FIRST
        const invoice =
          await this.invoiceGeneratorService.generateInvoiceForOrder(
            ctx,
            order.id,
          );

        // Create payment transaction record with invoice ID
        await this.createPaymentTransaction(ctx, order, session, invoice?.id);

        // Update invoice status from DRAFT to PAID after successful payment
        if (invoice) {
          await this.invoiceService.updateInvoiceStatus(
            ctx,
            invoice.id,
            InvoiceStatus.PAID,
          );
          this.logger.log(
            ctx,
            `Updated invoice ${invoice.id} (${invoice.invoiceNumber}) status to PAID after successful payment`,
          );
        }

        await this.createGoogleCalendarEvents(ctx, order);

        this.logger.log(
          ctx,
          `Successfully processed checkout completion for order ${orderId}`,
        );

        // Note: We can't emit here because transaction hasn't committed yet
        // Emit event will happen after transaction commits
        // Return true to indicate success
        return true;
      },
    );

    // After transaction commits, reload order to get updated googleMeetLink
    this.logger.log(ctx, `Transaction completed, result: ${result}`);

    if (result) {
      // Reload order explicitly to get googleMeetLink and customer relation
      const updatedOrder = await this.dataSource
        .getRepository(Order)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.customer', 'customer')
        .where('order.id = :id', { id: parseInt(orderId) })
        .getOne();

      if (!updatedOrder) {
        this.logger.error(ctx, `Order ${orderId} not found after transaction`);
        return;
      }

      this.logger.log(ctx, `Reloaded order ${orderId}`);
      this.logger.log(
        ctx,
        `Order googleMeetLink field: ${updatedOrder.googleMeetLink || 'MISSING'}`,
      );
      this.logger.log(
        ctx,
        `Order items count: ${updatedOrder.items?.length || 0}`,
      );

      // Emit event for automations with updated order
      this.logger.log(
        ctx,
        `About to emit ORDER_PAID event for order ${orderId}`,
      );
      this.logger.log(
        ctx,
        `Order googleMeetLink before emit: ${updatedOrder.googleMeetLink || 'MISSING'}`,
      );

      this.eventEmitter.emit(TriggerEvent.ORDER_PAID, {
        order: updatedOrder,
        ctx,
      });

      this.logger.log(ctx, `Emitted ORDER_PAID event for order ${orderId}`);
    }
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
      this.orderRepository,
    );
  }

  /**
   * Handles refund created webhook
   */
  async handleRefundCreated(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const refund = event.data.object as Stripe.Refund;
    this.logger.log(ctx, `Refund created: ${refund.id}`);

    try {
      // Find refund in our database by Stripe refund ID
      const refundRecord = await this.refundService.getRefundByStripeId(
        ctx,
        refund.id,
      );

      if (refundRecord) {
        // Update refund status based on Stripe status
        const status = this.mapStripeRefundStatus(refund.status);
        await this.refundService.updateRefundStatus(
          ctx,
          refundRecord.id,
          status,
          refund.id,
        );

        this.logger.log(
          ctx,
          `Updated refund ${refundRecord.id} status to ${status}`,
        );
      } else {
        this.logger.warn(
          ctx,
          `No refund record found for Stripe refund ${refund.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to handle refund created webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handles refund updated webhook
   */
  async handleRefundUpdated(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const refund = event.data.object as Stripe.Refund;
    this.logger.log(ctx, `Refund updated: ${refund.id}`);

    try {
      // Find refund in our database by Stripe refund ID
      const refundRecord = await this.refundService.getRefundByStripeId(
        ctx,
        refund.id,
      );

      if (refundRecord) {
        // Update refund status based on Stripe status
        const status = this.mapStripeRefundStatus(refund.status);
        await this.refundService.updateRefundStatus(
          ctx,
          refundRecord.id,
          status,
          refund.id,
        );

        this.logger.log(
          ctx,
          `Updated refund ${refundRecord.id} status to ${status}`,
        );
      } else {
        this.logger.warn(
          ctx,
          `No refund record found for Stripe refund ${refund.id}. This could be because:
          1. The refund was created directly in Stripe (not through our system)
          2. The refund record hasn't been created yet in our database
          3. There's a database connectivity issue
          
          Stripe refund details:
          - ID: ${refund.id}
          - Amount: ${refund.amount}
          - Status: ${refund.status}
          - Payment Intent: ${refund.payment_intent}
          - Created: ${new Date(refund.created * 1000).toISOString()}
          
          Consider creating a refund record manually or investigating the root cause.`,
        );

        // Optionally, create a refund record automatically if we can find the related order
        await this.handleMissingRefundRecord(ctx, refund);
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to handle refund updated webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw the error to avoid webhook retries for non-critical issues
    }
  }

  /* eslint-disable sonarjs/cognitive-complexity */
  private async handleMissingRefundRecord(
    ctx: RequestContext,
    stripeRefund: Stripe.Refund,
  ): Promise<void> {
    try {
      this.logger.log(
        ctx,
        `Attempting to create missing refund record for Stripe refund ${stripeRefund.id}`,
      );

      // Try to find the order by payment intent
      if (stripeRefund.payment_intent) {
        const paymentIntentId =
          typeof stripeRefund.payment_intent === 'string'
            ? stripeRefund.payment_intent
            : stripeRefund.payment_intent.id;

        const order =
          await this.orderService.findOneByPaymentIntentId(paymentIntentId);

        if (order) {
          this.logger.log(
            ctx,
            `Found order ${order.id} for payment intent ${stripeRefund.payment_intent}`,
          );

          // Create a refund record automatically
          const refundData = {
            originalOrderId: order.id,
            customerId: order.customerId,
            amount: stripeRefund.amount,
            currency: stripeRefund.currency,
            reason: this.mapStripeReasonToRefundReason(stripeRefund.reason),
            reasonDetails: `Auto-created from Stripe refund ${stripeRefund.id}`,
            stripeRefundId: stripeRefund.id,
          };

          try {
            // Create the refund record automatically
            const createdRefund =
              await this.refundService.createRefundFromWebhook(ctx, refundData);

            this.logger.log(
              ctx,
              `Successfully created refund record ${createdRefund.id} for Stripe refund ${stripeRefund.id}`,
            );

            // Update the refund status based on Stripe status
            const status = this.mapStripeRefundStatus(stripeRefund.status);
            await this.refundService.updateRefundStatus(
              ctx,
              createdRefund.id,
              status,
              stripeRefund.id,
            );

            this.logger.log(
              ctx,
              `Updated auto-created refund ${createdRefund.id} status to ${status}`,
            );
          } catch (createError) {
            this.logger.error(
              ctx,
              `Failed to auto-create refund record: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
            );

            // Fallback: log the details for manual creation
            this.logger.log(
              ctx,
              `Auto-creation details for refund record:
              - Order ID: ${refundData.originalOrderId}
              - Customer ID: ${refundData.customerId}
              - Amount: ${refundData.amount}
              - Currency: ${refundData.currency}
              - Reason: ${refundData.reason}
              - Stripe Refund ID: ${refundData.stripeRefundId}
              
              Consider creating this refund record manually in the database.`,
            );
          }
        } else {
          this.logger.warn(
            ctx,
            `No order found for payment intent ${stripeRefund.payment_intent}`,
          );
        }
      } else {
        this.logger.warn(
          ctx,
          `No payment intent found in Stripe refund ${stripeRefund.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to handle missing refund record: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    /* eslint-enable sonarjs/cognitive-complexity */
  }

  /**
   * Maps Stripe refund reason to our refund reason enum
   */
  private mapStripeReasonToRefundReason(
    stripeReason: string | null,
  ): RefundReason {
    switch (stripeReason) {
      case 'duplicate': {
        return RefundReason.DUPLICATE;
      }
      case 'fraudulent': {
        return RefundReason.FRAUDULENT;
      }
      case 'requested_by_customer': {
        return RefundReason.CUSTOMER_REQUEST;
      }
      default: {
        return RefundReason.OTHER;
      }
    }
  }

  /**
   * Maps Stripe refund status to our refund status
   */
  private mapStripeRefundStatus(stripeStatus: string | null): RefundStatus {
    if (!stripeStatus) {
      return RefundStatus.PROCESSING;
    }

    switch (stripeStatus) {
      case 'pending': {
        return RefundStatus.PENDING;
      }
      case 'succeeded': {
        return RefundStatus.COMPLETED;
      }
      case 'failed': {
        return RefundStatus.FAILED;
      }
      case 'cancelled': {
        return RefundStatus.CANCELLED;
      }
      default: {
        return RefundStatus.PROCESSING;
      }
    }
  }

  /**
   * Handles charge dispute created webhook
   */
  async handleChargeDisputeCreated(
    ctx: RequestContext,
    event: Stripe.Event,
  ): Promise<void> {
    const dispute = event.data.object as Stripe.Dispute;
    this.logger.log(ctx, `Charge dispute created: ${dispute.id}`);

    try {
      // Find the order associated with this charge by searching through stripe_meta
      const chargeId =
        typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
      const order = await this.orderService.findOneByChargeId(chargeId);

      if (order) {
        this.logger.log(
          ctx,
          `Dispute ${dispute.id} found for order ${order.id}`,
        );

        // Update order status or add dispute information
        // This is a placeholder - implement based on your business logic
        this.logger.warn(
          ctx,
          `Order ${order.id} has a dispute ${dispute.id} - manual review required`,
        );
      } else {
        this.logger.warn(
          ctx,
          `No order found for dispute charge ${dispute.charge}`,
        );
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to handle charge dispute created webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Creates a payment transaction record from a successful checkout session
   * ALWAYS stores amounts in CAD
   */
  private async createPaymentTransaction(
    ctx: RequestContext,
    order: Order,
    session: StripeCheckoutSession,
    invoiceId?: number,
  ): Promise<void> {
    try {
      this.logger.log(
        ctx,
        `Creating payment transaction for order ${order.id}`,
      );

      // Get invoice to ensure amounts match exactly
      let invoiceAmount = 0;
      let invoiceTax = 0;
      let invoiceTotal = 0;

      if (invoiceId) {
        const invoice = await this.invoiceService.getInvoiceById(
          ctx,
          invoiceId,
        );
        if (invoice) {
          // Use invoice amounts (already in CAD)
          invoiceAmount = Number(invoice.subtotal);
          invoiceTax = Number(invoice.tax);
          invoiceTotal = Number(invoice.total);

          this.logger.log(
            ctx,
            `Using invoice amounts: subtotal=${invoiceAmount}, tax=${invoiceTax}, total=${invoiceTotal}`,
          );
        }
      }

      // If no invoice or couldn't get it, calculate from order items (already in CAD)
      if (!invoiceAmount) {
        invoiceAmount = order.items.reduce((total, item) => {
          return total + item.price * item.quantity * 100; // Convert to cents
        }, 0);
        this.logger.log(
          ctx,
          `Using order items for transaction: ${invoiceAmount} CAD`,
        );
      }

      this.logger.log(
        ctx,
        `Payment transaction: amount=${invoiceAmount} CAD (subtotal only, no tax)`,
      );

      await this.paymentTransactionService.createPaymentTransaction(ctx, {
        orderId: order.id,
        customerId: order.customerId,
        type: TransactionType.PAYMENT,
        amount: invoiceAmount, // Match invoice subtotal
        currency: 'CAD', // Always store in CAD
        paymentMethod: 'card', // Default for Stripe checkout
        stripePaymentIntentId: order.stripe_meta?.paymentIntentId,
        stripeChargeId: order.stripe_meta?.paymentIntentId, // Using payment intent as charge ID
        status: 'succeeded',
        invoiceId, // Link to the invoice
        metadata: {
          checkoutSessionId: session.id,
          checkoutSessionUrl: session.url || undefined,
          paymentStatus: session.payment_status,
          orderItems: order.items,
          taxAmount: invoiceTax, // Tax from invoice (in CAD)
          invoiceSubtotal: invoiceAmount, // Subtotal from invoice (in CAD)
          totalAmountIncludingTax: invoiceTotal, // Total from invoice (in CAD)
          paidCurrency: session.currency?.toUpperCase(),
          convertedToCad: session.currency?.toUpperCase() !== 'CAD',
        },
      });

      this.logger.log(
        ctx,
        `Successfully created payment transaction for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create payment transaction for order ${order.id}${invoiceId ? ` with invoice ${invoiceId}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - we don't want to fail the entire webhook processing
    }
  }
}
