import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { GoogleCalendarModule } from '../shared/services/google-calendar/google-calendar.module';
import { Task } from './entities/task.entity';
import { TaskController } from './controller/task.controller';
import { TaskService } from './service/task.service';
import { TaskRepository } from './repository/task.repository';
import { TaskAclService } from './service/task-acl.service';
import { CalendarEventToTaskService } from './services/calendar-event-to-task.service';
import { TaskToCalendarEventService } from './services/task-to-calendar-event.service';
import { TaskRepositoryService } from './services/task-repository.service';
import { TaskValidationService } from './services/task-validation.service';
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
    TaskAclService,
    CalendarEventToTaskService,
    TaskToCalendarEventService,
    TaskRepositoryService,
    TaskValidationService,
  ],
  exports: [TaskService],
})
export class TaskModule {}
