import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthStrategy } from '../auth/strategies/jwt-auth.strategy';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { SharedModule } from '../shared/shared.module';
import { UserController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserAclService } from './services/user-acl.service';
import { RBACGuard } from '../shared/guards/rbac.guard';
import { GhlService } from '../shared/services/Ghl.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([User]),
    GoogleCalendarModule,
  ],
  providers: [
    UserService,
    JwtAuthStrategy,
    UserAclService,
    UserRepository,
    RBACGuard,
    GhlService,
  ],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
