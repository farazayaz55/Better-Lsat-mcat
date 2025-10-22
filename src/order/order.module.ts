import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GhlService } from '../shared/services/Ghl.service';
import { StripeService } from '../shared/services/stripe.service';
import { WooCommerceService } from '../shared/services/WooCommerce.service';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { Order } from './entities/order.entity';
import { OrderController } from './order.controller';
import { OrderService } from './services/order.service';
import { OrderRepository } from './repository/order.repository';
import { ReservationCleanupService } from './reservation-cleanup.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([Order]),
    UserModule,
    ProductModule,
    GoogleCalendarModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderRepository,
    WooCommerceService,
    GhlService,
    StripeService,
    ReservationCleanupService,
  ],
  exports: [OrderService, ReservationCleanupService],
})
export class OrderModule {}
