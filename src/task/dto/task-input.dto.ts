import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
} from 'class-validator';

import { TaskLabel, TaskPriority, TaskStatus } from '../entities/task.entity';

export class TaskInputDto {
  @ApiProperty({
    description: 'Task title',
    example: 'Prepare lesson materials',
    maxLength: 200,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'Task description',
    example: 'Review chapter 5 and prepare exercises',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Task start date and time',
    example: '2024-01-15T14:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startDateTime: string;

  @ApiProperty({
    description: 'Task end date and time',
    example: '2024-01-15T15:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endDateTime: string;

  @ApiProperty({ description: 'Tutor ID who created this task', example: 1 })
  @IsNotEmpty()
  tutorId: number;

  @ApiProperty({
    description: 'Task label',
    enum: TaskLabel,
    example: TaskLabel.MEETING,
  })
  @IsNotEmpty()
  @IsEnum(TaskLabel)
  label: TaskLabel;

  @ApiPropertyOptional({
    description: 'Task priority',
    enum: TaskPriority,
    example: TaskPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'Task status',
    enum: TaskStatus,
    example: TaskStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
