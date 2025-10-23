import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { GoogleCalendarModule } from '../shared/services/google-calendar/google-calendar.module';
import { SharedModule } from '../shared/shared.module';
import { PhoneNormalizerService } from '../shared/utils/phone-normalizer.service';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserAclService } from './services/user-acl.service';
import { GhlService } from '../shared/services/Ghl.service';
import { OrderRepository } from '../order/repository/order.repository';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Order]),
    GoogleCalendarModule,
  ],
  providers: [
    UserService,
    JwtAuthStrategy,
    UserAclService,
    UserRepository,
    OrderRepository,
    GhlService,
    PhoneNormalizerService,
  ],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
