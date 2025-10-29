/* eslint-disable max-depth */
/* eslint-disable security/detect-object-injection */
/* eslint-disable max-statements */
/* eslint-disable sonarjs/cognitive-complexity */
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
import { StripeWebhookHandlerService } from './services/stripe-webhook-handler.service';
import { WebhookErrorMapperService } from './services/webhook-error-mapper.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly logger: AppLogger,
    private readonly stripeService: StripeService,
    private readonly stripeWebhookHandler: StripeWebhookHandlerService,
    private readonly errorMapper: WebhookErrorMapperService,
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
          await this.stripeWebhookHandler.handleCheckoutSessionCompleted(
            ctx,
            event,
          );
          break;
        }
        case 'payment_intent.succeeded': {
          this.logger.log(ctx, '=== HANDLING PAYMENT INTENT SUCCEEDED ===');
          await this.stripeWebhookHandler.handlePaymentIntentSucceeded(
            ctx,
            event,
          );
          break;
        }
        case 'payment_intent.payment_failed': {
          this.logger.log(ctx, '=== HANDLING PAYMENT INTENT FAILED ===');
          await this.stripeWebhookHandler.handlePaymentIntentFailed(ctx, event);
          break;
        }
        case 'charge.dispute.created': {
          this.logger.log(ctx, '=== HANDLING CHARGE DISPUTE CREATED ===');
          await this.stripeWebhookHandler.handleChargeDisputeCreated(
            ctx,
            event,
          );
          break;
        }
        case 'refund.created': {
          this.logger.log(ctx, '=== HANDLING REFUND CREATED ===');
          await this.stripeWebhookHandler.handleRefundCreated(ctx, event);
          break;
        }
        case 'refund.updated': {
          this.logger.log(ctx, '=== HANDLING REFUND UPDATED ===');
          await this.stripeWebhookHandler.handleRefundUpdated(ctx, event);
          break;
        }
        case 'charge.refund.updated': {
          this.logger.log(ctx, '=== HANDLING CHARGE REFUND UPDATED ===');
          await this.stripeWebhookHandler.handleRefundUpdated(ctx, event);
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
      throw this.errorMapper.mapWebhookError(error, ctx);
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
          await this.stripeWebhookHandler.handleCheckoutSessionCompleted(
            ctx,
            testEvent,
          );
          break;
        }
        case 'payment_intent.succeeded': {
          await this.stripeWebhookHandler.handlePaymentIntentSucceeded(
            ctx,
            testEvent,
          );
          break;
        }
        case 'payment_intent.payment_failed': {
          await this.stripeWebhookHandler.handlePaymentIntentFailed(
            ctx,
            testEvent,
          );
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
      throw this.errorMapper.mapWebhookError(error, ctx);
    }
  }
}
