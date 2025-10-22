import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { Task } from './entities/task.entity';
import { TaskController } from './controller/task.controller';
import { TaskService } from './service/task.service';
import { TaskRepository } from './repository/task.repository';
import { GoogleCalendarService } from '../shared/services/google-calendar-api-key.service';
import { TaskAclService } from './service/task-acl.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    SharedModule,
    UserModule,
    GoogleCalendarModule,
    OrderModule,
    TypeOrmModule.forFeature([Task]),
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    TaskRepository,
    GoogleCalendarService,
    TaskAclService,
  ],
  exports: [TaskService],
})
export class TaskModule {}
