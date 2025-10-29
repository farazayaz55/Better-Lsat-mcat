import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { AppLogger } from '../../../shared/logger/logger.service';
import { StripeService } from '../../../shared/services/stripe.service';
import { PaymentService } from '../../../order/services/payment.service';
import { OrderService } from '../../../order/services/order.service';
import { Refund } from '../../entities/refund.entity';
import { RefundReason } from '../../constants/finance.constant';
import { Order } from '../../../order/entities/order.entity';

export interface StripeRefundRequest {
  paymentIntentId: string;
  amount: number;
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata: Record<string, string>;
}

@Injectable()
export class RefundStripeProcessor {
  constructor(
    private readonly stripeService: StripeService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(RefundStripeProcessor.name);
  }

  /**
   * Finds the payment intent ID for an order
   */
  async findPaymentIntent(ctx: RequestContext, order: Order): Promise<string> {
    // Extract payment intent ID from order's stripe metadata
    let paymentIntentId = order.stripe_meta?.paymentIntentId;

    // If no payment intent ID, try to get it from checkout session
    if (!paymentIntentId && order.stripe_meta?.checkoutSessionId) {
      try {
        this.logger.log(
          ctx,
          `No payment intent ID found, retrieving from checkout session: ${order.stripe_meta.checkoutSessionId}`,
        );

        // Retrieve the checkout session to get the payment intent
        const session = await this.stripeService.retrieveCheckoutSession(
          ctx,
          order.stripe_meta.checkoutSessionId,
        );

        if (session.payment_intent) {
          paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id;

          this.logger.log(
            ctx,
            `Found payment intent ${paymentIntentId} from checkout session`,
          );

          // Update the order's stripe_meta with the payment intent ID for future use
          await this.paymentService.updateStripeMeta(ctx, order.id, {
            ...order.stripe_meta,
            paymentIntentId,
          });
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to retrieve payment intent from checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!paymentIntentId) {
      this.logger.error(
        ctx,
        `Order ${order.id} stripe_meta: ${JSON.stringify(order.stripe_meta)}`,
      );
      throw new Error(
        `No payment intent found for order ${order.id}. ` +
          `This order may have been created before payment processing was implemented, ` +
          `or the payment intent creation failed. ` +
          `Available stripe_meta fields: ${order.stripe_meta ? Object.keys(order.stripe_meta).join(', ') : 'none'}`,
      );
    }

    return paymentIntentId;
  }

  /**
   * Converts refund amount from CAD to the original payment currency
   */
  async convertRefundAmount(
    ctx: RequestContext,
    refundAmountInCad: number,
    originalPaymentCurrency: string,
  ): Promise<number> {
    // If already CAD, no conversion needed
    if (originalPaymentCurrency === 'CAD') {
      return Math.round(refundAmountInCad);
    }

    try {
      // Get exchange rates from CAD to original payment currency
      const rates = await this.stripeService.getExchangeRates(ctx, 'CAD');
      const conversionRate = rates.rates[originalPaymentCurrency];

      if (conversionRate) {
        const convertedAmount = Math.round(refundAmountInCad * conversionRate);
        this.logger.log(
          ctx,
          `Converted refund amount from CAD to ${originalPaymentCurrency}: ${refundAmountInCad} CAD * ${conversionRate} = ${convertedAmount} ${originalPaymentCurrency}`,
        );
        return convertedAmount;
      } else {
        this.logger.warn(
          ctx,
          `Could not find exchange rate for ${originalPaymentCurrency}, using CAD amount as-is`,
        );
        return Math.round(refundAmountInCad);
      }
    } catch (error) {
      this.logger.warn(
        ctx,
        `Failed to convert refund amount: ${error instanceof Error ? error.message : 'Unknown error'}, using CAD amount as-is`,
      );
      return Math.round(refundAmountInCad);
    }
  }

  /**
   * Creates a refund in Stripe
   */
  async createStripeRefund(
    ctx: RequestContext,
    request: StripeRefundRequest,
  ): Promise<{ id: string }> {
    const stripeRefund = await this.stripeService.createRefund(ctx, {
      paymentIntentId: request.paymentIntentId,
      amount: request.amount,
      reason: request.reason,
      metadata: request.metadata,
    });

    return { id: stripeRefund.id };
  }

  /**
   * Maps refund reason to Stripe reason format
   */
  mapRefundReasonToStripe(
    reason: RefundReason,
  ): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
    switch (reason) {
      case RefundReason.DUPLICATE: {
        return 'duplicate';
      }
      case RefundReason.FRAUDULENT: {
        return 'fraudulent';
      }
      case RefundReason.CUSTOMER_REQUEST: {
        return 'requested_by_customer';
      }
      default: {
        return 'requested_by_customer';
      }
    }
  }

  /**
   * Gets the original payment currency from order metadata
   */
  getOriginalPaymentCurrency(order: Order): string {
    return (
      order.stripe_meta?.paidCurrency?.toUpperCase() ||
      order.stripe_meta?.currency?.toUpperCase() ||
      'CAD'
    );
  }
}
