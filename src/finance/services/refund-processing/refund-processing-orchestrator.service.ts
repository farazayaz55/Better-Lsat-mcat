import { Injectable, NotFoundException , Inject, forwardRef } from '@nestjs/common';
import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { AppLogger } from '../../../shared/logger/logger.service';
import { RefundRepository } from '../../repositories/refund.repository';
import { Refund } from '../../entities/refund.entity';
import { RefundStatus , TransactionType } from '../../constants/finance.constant';
import { RefundProcessingError } from '../../../shared/exceptions/financial.exceptions';
import { RefundStripeProcessor } from './refund-stripe-processor.service';
import { RefundInvoiceHandler } from './refund-invoice-handler.service';
import { PaymentTransactionService } from '../payment-transaction.service';
import { OrderService } from '../../../order/services/order.service';
import { PaymentStatus } from '../../../order/interfaces/stripe-metadata.interface';
import { ProcessRefundDto } from '../../dto/refund.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RefundProcessedEvent } from '../../../shared/events/refund-processed.event';

@Injectable()
export class RefundProcessingOrchestrator {
  constructor(
    private readonly refundRepository: RefundRepository,
    private readonly stripeProcessor: RefundStripeProcessor,
    private readonly invoiceHandler: RefundInvoiceHandler,
    private readonly paymentTransactionService: PaymentTransactionService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(RefundProcessingOrchestrator.name);
  }

  /**
   * Orchestrates the complete refund processing flow
   */
  async processRefund(
    ctx: RequestContext,
    refundId: number,
    processData: ProcessRefundDto,
  ): Promise<Refund> {
    this.logger.log(
      ctx,
      `Orchestrating refund processing for refund ${refundId}`,
    );

    // 1. Validate refund exists and is in pending status
    const refund = await this.refundRepository.findById(refundId);
    if (!refund) {
      throw new NotFoundException(`Refund with ID ${refundId} not found`);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new RefundProcessingError(
        `Refund ${refundId} is not in pending status`,
        refundId,
      );
    }

    try {
      // 2. Update status to processing
      await this.refundRepository.update(refundId, {
        status: RefundStatus.PROCESSING,
      });

      // 3. Get the original order
      const order = await this.orderService.findOne(refund.originalOrderId);
      if (!order) {
        throw new NotFoundException(
          `Order ${refund.originalOrderId} not found`,
        );
      }

      // 4. Process Stripe refund
      const paymentIntentId = await this.stripeProcessor.findPaymentIntent(
        ctx,
        order,
      );

      const originalPaymentCurrency =
        this.stripeProcessor.getOriginalPaymentCurrency(order);

      this.logger.log(
        ctx,
        `Refund amount in CAD: ${refund.amount}, Original payment currency: ${originalPaymentCurrency}`,
      );

      const refundAmountForStripe =
        await this.stripeProcessor.convertRefundAmount(
          ctx,
          refund.amount,
          originalPaymentCurrency,
        );

      const stripeReason = this.stripeProcessor.mapRefundReasonToStripe(
        refund.reason,
      );

      const stripeRefund = await this.stripeProcessor.createStripeRefund(ctx, {
        paymentIntentId,
        amount: refundAmountForStripe,
        reason: stripeReason,
        metadata: {
          refundId: refund.id.toString(),
          refundNumber: refund.refundNumber,
          originalOrderId: refund.originalOrderId.toString(),
          customerId: refund.customerId.toString(),
          refundAmountInCad: refund.amount.toString(),
          refundAmountInPaymentCurrency: refundAmountForStripe.toString(),
          originalPaymentCurrency,
        },
      });

      // 5. Void invoice
      await this.invoiceHandler.voidInvoice(
        ctx,
        refund.invoiceId,
        `Refund processed: ${refund.reasonDetails}`,
      );

      // 6. Update refund entity first (before emitting event)
      await this.refundRepository.update(refundId, {
        status: RefundStatus.COMPLETED,
        stripeRefundId: stripeRefund.id,
        refundedAt: new Date(),
        processedBy: ctx.user?.id,
        metadata: {
          refundAmountInCad: refund.amount,
          refundAmountInPaymentCurrency: refundAmountForStripe,
          originalPaymentCurrency,
        },
      });

      const updatedRefund = await this.refundRepository.findById(refundId);
      if (!updatedRefund) {
        throw new Error(`Failed to retrieve updated refund ${refundId}`);
      }

      // 7. Emit event for order updates (event-driven, removes circular dependency)
      this.eventEmitter.emit(
        'refund.processed',
        new RefundProcessedEvent(
          updatedRefund.id,
          refund.originalOrderId,
          refund.customerId,
          updatedRefund.refundNumber,
          updatedRefund.amount,
          updatedRefund.currency,
          refund.reason,
          refund.reasonDetails,
          stripeRefund.id,
        ),
      );

      // 8. Create payment transaction (non-blocking)
      try {
        await this.paymentTransactionService.createPaymentTransaction(ctx, {
          orderId: refund.originalOrderId,
          customerId: refund.customerId,
          type: TransactionType.REFUND,
          amount: refund.amount,
          currency: refund.currency,
          paymentMethod: 'card',
          stripePaymentIntentId: order.stripe_meta?.paymentIntentId,
          stripeChargeId: stripeRefund.id,
          status: 'succeeded',
          invoiceId: refund.invoiceId,
          metadata: {
            refundId: updatedRefund.id.toString(),
            refundNumber: updatedRefund.refundNumber,
            stripeRefundId: stripeRefund.id,
            reason: refund.reason,
            reasonDetails: refund.reasonDetails,
          },
        });

        this.logger.log(
          ctx,
          `Created payment transaction for refund ${refundId}`,
        );
      } catch (transactionError) {
        this.logger.error(
          ctx,
          `Failed to create payment transaction for refund ${refundId}: ${
            transactionError instanceof Error
              ? transactionError.message
              : 'Unknown error'
          }`,
        );
        // Don't throw - we don't want to fail the refund if transaction creation fails
      }

      this.logger.log(
        ctx,
        `Successfully processed refund ${refundId} with Stripe refund ID: ${stripeRefund.id}`,
      );

      return updatedRefund;
    } catch (error) {
      // Update refund status to failed on any error
      await this.refundRepository.update(refundId, {
        status: RefundStatus.FAILED,
      });

      this.logger.error(
        ctx,
        `Failed to process refund ${refundId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
