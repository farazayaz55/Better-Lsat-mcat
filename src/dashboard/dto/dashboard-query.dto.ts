import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TimePeriod } from '../constants/time-period.constant';

export class DashboardQueryDto {
  @ApiProperty({
    description: 'Time period for dashboard data',
    enum: TimePeriod,
    example: TimePeriod.MONTH,
  })
  @IsEnum(TimePeriod)
  period: TimePeriod;

  @ApiPropertyOptional({
    description: 'Include top customers data',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeTopCustomers?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include revenue metrics',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeRevenue?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include appointments overview',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeAppointments?: boolean = true;

  @ApiPropertyOptional({
    description: 'Number of top customers to return',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  topCustomersLimit?: number = 10;

  @ApiPropertyOptional({
    description: 'Include tax collection metrics',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeTaxCollection?: boolean = true;

  @ApiPropertyOptional({
    description: 'Include refund metrics',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeRefunds?: boolean = true;
}
