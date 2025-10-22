import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { SharedModule } from '../shared/shared.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardAclService } from './dashboard-acl.service';

@Module({
  imports: [
    OrderModule, // Import to get OrderService
    UserModule, // Import to get UserService
    SharedModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAclService],
  exports: [DashboardService],
})
export class DashboardModule {}
