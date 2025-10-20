import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { TaskLabel, TaskPriority, TaskStatus } from '../entities/task.entity';
import { UserOutput } from '../../user/dto/user-output.dto';

export class TaskOutputDto {
  @Expose()
  @ApiProperty({ description: 'Task ID', example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ description: 'Task title', example: 'Prepare lesson materials' })
  title: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Task description', example: 'Review chapter 5 and prepare exercises' })
  description?: string;

  @Expose()
  @ApiProperty({ description: 'Task start date and time', example: '2024-01-15T14:00:00.000Z' })
  startDateTime: Date;

  @Expose()
  @ApiProperty({ description: 'Task end date and time', example: '2024-01-15T15:00:00.000Z' })
  endDateTime: Date;

  @Expose()
  @ApiProperty({ description: 'Tutor ID who created this task', example: 1 })
  tutorId: number;

  @Expose()
  @Type(() => UserOutput)
  @ApiProperty({ description: 'Tutor who created this task', type: UserOutput })
  tutor: UserOutput;

  @Expose()
  @ApiPropertyOptional({ description: 'Google Calendar event ID', example: 'abc123def456' })
  googleCalendarEventId?: string;

  @Expose()
  @ApiProperty({ description: 'Task label', enum: TaskLabel, example: TaskLabel.MEETING })
  label: TaskLabel;

  @Expose()
  @ApiProperty({ description: 'Task priority', enum: TaskPriority, example: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Expose()
  @ApiProperty({ description: 'Task status', enum: TaskStatus, example: TaskStatus.PENDING })
  status: TaskStatus;

  @Expose()
  @ApiProperty({ description: 'Task creation timestamp', example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ description: 'Task last update timestamp', example: '2024-01-15T12:00:00.000Z' })
  updatedAt: Date;
}
