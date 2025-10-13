import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { StripeService } from '../shared/services/stripe.service';
import { SharedModule } from '../shared/shared.module';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { RawBodyMiddleware } from '../shared/middlewares/raw-body.middleware';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [SharedModule, OrderModule, GoogleCalendarModule, UserModule],
  controllers: [WebhookController],
  providers: [StripeService],
})
export class WebhookModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RawBodyMiddleware).forRoutes('webhooks/stripe');
  }
}
