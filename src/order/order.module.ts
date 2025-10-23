import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GhlService } from '../shared/services/Ghl.service';
import { StripeService } from '../shared/services/stripe.service';
import { WooCommerceService } from '../shared/services/WooCommerce.service';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { SharedModule } from '../shared/shared.module';
import { SlotModule } from '../shared/slot/slot.module';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { Order } from './entities/order.entity';
import { OrderController } from './order.controller';
import { OrderService } from './services/order.service';
import { PaymentService } from './services/payment.service';
import { AnalyticsService } from './services/analytics.service';
import { EmployeeAssignmentService } from './services/employee-assignment.service';
import { OrderRepository } from './repository/order.repository';
import { ReservationCleanupService } from './reservation-cleanup.service';

@Module({
  imports: [
    SharedModule,
    SlotModule,
    TypeOrmModule.forFeature([Order]),
    UserModule,
    ProductModule,
    GoogleCalendarModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    PaymentService,
    AnalyticsService,
    EmployeeAssignmentService,
    OrderRepository,
    WooCommerceService,
    GhlService,
    StripeService,
    ReservationCleanupService,
  ],
  exports: [
    OrderService,
    PaymentService,
    AnalyticsService,
    ReservationCleanupService,
  ],
})
export class OrderModule {}
