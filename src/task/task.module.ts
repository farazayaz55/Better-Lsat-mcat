import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../shared/shared.module';
import { UserModule } from '../user/user.module';
import { GoogleCalendarModule } from '../shared/google-calendar.module';
import { Task } from './entities/task.entity';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRepository } from './repository/task.repository';

@Module({
  imports: [
    SharedModule,
    UserModule,
    GoogleCalendarModule,
    TypeOrmModule.forFeature([Task]),
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService],
})
export class TaskModule {}
