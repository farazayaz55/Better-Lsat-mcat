import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrderModule } from './order/order.module';
import { GoogleCalendarModule } from './shared/google-calendar.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';
import { WebhookModule } from './webhooks/webhook.module';

@Module({
  imports: [
    SharedModule,
    UserModule,
    AuthModule,
    OrderModule, // Test commit
    WebhookModule,
    GoogleCalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
