import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { TaskLabel, TaskPriority, TaskStatus } from '../entities/task.entity';

export class TaskQueryDto {
  @ApiPropertyOptional({ description: 'Filter by tutor ID', example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  tutorId?: number;

  @ApiPropertyOptional({
    description: 'Filter by task status',
    enum: TaskStatus,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter by task priority',
    enum: TaskPriority,
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by task label', enum: TaskLabel })
  @IsOptional()
  @IsEnum(TaskLabel)
  label?: TaskLabel;

  @ApiPropertyOptional({
    description: 'Filter tasks from this date',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter tasks to this date',
    example: '2024-01-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of tasks to return',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Include tasks from Calendar',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    // Convert string '1' to true, '0' to false
    if (value === '1') return true;
    if (value === '0') return false;
    // Default to true if value is undefined/null
    if (value === undefined || value === null) return true;
    // For any other value, try to convert to boolean
    return Boolean(value);
  })
  @IsBoolean()
  googleCalendar?: boolean = true;

  @ApiPropertyOptional({
    description: 'Number of tasks to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
