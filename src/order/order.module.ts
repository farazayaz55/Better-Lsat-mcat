import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GhlService } from '../shared/services/Ghl.service';
import { WooCommerceService } from '../shared/services/WooCommerce.service';
import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { Order } from './entities/order.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderRepository } from './repository/order.repository';

@Module({
  imports: [SharedModule, TypeOrmModule.forFeature([Order]), UserModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository, WooCommerceService, GhlService],
  exports: [OrderService],
})
export class OrderModule {}
