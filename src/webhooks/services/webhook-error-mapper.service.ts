import { Injectable, Logger ,
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestContext } from '../../shared/request-context/request-context.dto';

@Injectable()
export class WebhookErrorMapperService {
  private readonly logger = new Logger(WebhookErrorMapperService.name);

  /**
   * Maps webhook errors to appropriate HTTP exceptions
   * @param error The error to map
   * @param ctx Request context for logging
   * @returns Appropriate HTTP exception
   */
  mapWebhookError(error: any, ctx: RequestContext): HttpException {
    // Log the full error for debugging
    this.logger.error(ctx, `Webhook Error Details: ${JSON.stringify(error)}`);

    // Map specific error types to appropriate HTTP status codes
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Stripe signature verification errors
      if (
        errorMessage.includes('signature') ||
        errorMessage.includes('webhook')
      ) {
        this.logger.warn(ctx, 'Webhook signature verification failed');
        return new BadRequestException('Invalid webhook signature');
      }

      // Database/order related errors
      if (errorMessage.includes('order') || errorMessage.includes('database')) {
        this.logger.error(
          ctx,
          'Database operation failed during webhook processing',
        );
        return new InternalServerErrorException(
          'Failed to process webhook data',
        );
      }

      // Payment processing errors
      if (errorMessage.includes('payment') || errorMessage.includes('stripe')) {
        this.logger.error(ctx, 'Payment processing error in webhook');
        return new InternalServerErrorException('Payment processing failed');
      }

      // Calendar integration errors
      if (
        errorMessage.includes('calendar') ||
        errorMessage.includes('google')
      ) {
        this.logger.warn(
          ctx,
          'Calendar integration failed, but webhook can continue',
        );
        return new InternalServerErrorException('Calendar integration failed');
      }

      // Validation errors
      if (
        errorMessage.includes('validation') ||
        errorMessage.includes('invalid')
      ) {
        this.logger.warn(ctx, 'Webhook data validation failed');
        return new BadRequestException('Invalid webhook data');
      }

      // Authentication/authorization errors
      if (
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('login required')
      ) {
        this.logger.warn(ctx, 'Authentication error in webhook');
        return new BadRequestException('Authentication required');
      }

      // Network/timeout errors
      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
      ) {
        this.logger.error(ctx, 'Network error in webhook processing');
        return new InternalServerErrorException('Network error occurred');
      }
    }

    // Default fallback for unknown errors
    this.logger.error(ctx, 'Unknown webhook error occurred');
    return new InternalServerErrorException('Webhook processing failed');
  }

  /**
   * Maps specific Stripe errors to HTTP exceptions
   * @param stripeError The Stripe error
   * @param ctx Request context
   * @returns Appropriate HTTP exception
   */
  mapStripeError(stripeError: any, ctx: RequestContext): HttpException {
    this.logger.error(
      ctx,
      `Stripe Error Details: ${JSON.stringify(stripeError)}`,
    );

    if (stripeError.type) {
      switch (stripeError.type) {
        case 'card_error': {
          this.logger.warn(ctx, 'Card error in Stripe webhook');
          return new BadRequestException('Card processing error');
        }

        case 'rate_limit_error': {
          this.logger.warn(ctx, 'Rate limit error in Stripe webhook');
          return new InternalServerErrorException('Rate limit exceeded');
        }

        case 'invalid_request_error': {
          this.logger.warn(ctx, 'Invalid request error in Stripe webhook');
          return new BadRequestException('Invalid request');
        }

        case 'api_error': {
          this.logger.error(ctx, 'API error in Stripe webhook');
          return new InternalServerErrorException('Stripe API error');
        }

        case 'authentication_error': {
          this.logger.error(ctx, 'Authentication error in Stripe webhook');
          return new BadRequestException('Stripe authentication error');
        }

        default: {
          this.logger.error(
            ctx,
            `Unknown Stripe error type: ${stripeError.type}`,
          );
          return new InternalServerErrorException('Stripe processing error');
        }
      }
    }

    return this.mapWebhookError(stripeError, ctx);
  }

  /**
   * Maps calendar integration errors to HTTP exceptions
   * @param calendarError The calendar error
   * @param ctx Request context
   * @returns Appropriate HTTP exception
   */
  mapCalendarError(calendarError: any, ctx: RequestContext): HttpException {
    this.logger.error(
      ctx,
      `Calendar Error Details: ${JSON.stringify(calendarError)}`,
    );

    if (calendarError instanceof Error) {
      const errorMessage = calendarError.message.toLowerCase();

      if (errorMessage.includes('quota')) {
        this.logger.warn(ctx, 'Google Calendar quota exceeded');
        return new InternalServerErrorException('Calendar quota exceeded');
      }

      if (errorMessage.includes('permission')) {
        this.logger.warn(ctx, 'Google Calendar permission error');
        return new BadRequestException('Calendar permission denied');
      }

      if (errorMessage.includes('not found')) {
        this.logger.warn(ctx, 'Google Calendar resource not found');
        return new BadRequestException('Calendar resource not found');
      }
    }

    return this.mapWebhookError(calendarError, ctx);
  }
}
