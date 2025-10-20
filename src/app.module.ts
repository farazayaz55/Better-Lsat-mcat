import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { TaskModule } from './task/task.module';
import { GoogleCalendarModule } from './shared/google-calendar.module';
import { SharedModule } from './shared/shared.module';
import { UserModule } from './user/user.module';
import { WebhookModule } from './webhooks/webhook.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
    SharedModule,
    UserModule,
    AuthModule,
    OrderModule,
    ProductModule,
    TaskModule,
    WebhookModule,
    GoogleCalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
