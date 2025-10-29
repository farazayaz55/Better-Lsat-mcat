import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { TaskModule } from './task/task.module';
import { GoogleCalendarModule } from './shared/google-calendar.module';
import { SharedModule } from './shared/shared.module';
import { SlotModule } from './shared/slot/slot.module';
import { UserModule } from './user/user.module';
import { WebhookModule } from './webhooks/webhook.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { FinanceModule } from './finance/finance.module';
import { AutomationModule } from './automation/automation.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(), // Enable event emitters
    ScheduleModule.forRoot(), // Enable cron jobs
    BullBoardModule.forRoot({
      // Bull Board monitoring dashboard
      // Access at http://localhost:3000/admin/queues
      route: '/admin/queues',
      adapter: ExpressAdapter, // Use ExpressAdapter for NestJS
    }),
    SharedModule,
    UserModule,
    AuthModule,
    OrderModule,
    ProductModule,
    TaskModule,
    DashboardModule,
    WebhookModule,
    GoogleCalendarModule,
    SlotModule, // Add SlotModule to register SlotController
    InvoicingModule, // Add InvoicingModule
    FinanceModule, // Add FinanceModule
    AutomationModule, // Add AutomationModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
