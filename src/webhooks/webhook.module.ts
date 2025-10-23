import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StripeService } from '../shared/services/stripe.service';
import { SharedModule } from '../shared/shared.module';
import { GoogleCalendarModule } from '../shared/services/google-calendar/google-calendar.module';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { RawBodyMiddleware } from '../shared/middlewares/raw-body.middleware';
import { WebhookController } from './webhook.controller';
import { StripeWebhookHandlerService } from './services/stripe-webhook-handler.service';
import { WebhookValidationService } from './services/webhook-validation.service';
import { WebhookErrorMapperService } from './services/webhook-error-mapper.service';

@Module({
  imports: [SharedModule, OrderModule, GoogleCalendarModule, UserModule],
  controllers: [WebhookController],
  providers: [
    StripeService,
    StripeWebhookHandlerService,
    WebhookValidationService,
    WebhookErrorMapperService,
  ],
})
export class WebhookModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RawBodyMiddleware).forRoutes('webhooks/stripe');
  }
}
