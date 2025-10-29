import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { PaginationParamsDto } from '../../shared/dtos/pagination-params.dto';
import {
  TransactionType,
  TRANSACTION_TYPES,
} from '../constants/finance.constant';

export class TransactionQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({
    enum: TRANSACTION_TYPES,
    description: 'Filter by transaction type',
    example: TransactionType.PAYMENT,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    example: 'succeeded',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 123,
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  customerId?: number;

  @ApiPropertyOptional({
    description: 'Filter by order ID',
    example: 383,
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Filter by invoice ID',
    example: 1,
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  invoiceId?: number;

  @ApiPropertyOptional({
    description: 'Filter by transactions created after this date (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by transactions created before this date (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Minimum amount in cents',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Maximum amount in cents',
    example: 100000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => parseInt(value))
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    example: 'card',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Filter by currency code',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['createdAt', 'amount', 'status', 'type'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'amount' | 'status' | 'type';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
