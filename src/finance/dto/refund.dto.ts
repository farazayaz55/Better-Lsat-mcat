import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { RefundStatus, RefundReason } from '../constants/finance.constant';

export class CreateRefundDto {
  @ApiProperty({
    description: 'ID of the original order being refunded',
    example: 383,
  })
  @IsNumber()
  originalOrderId: number;

  @ApiProperty({
    description: 'ID of the customer requesting the refund',
    example: 174,
  })
  @IsNumber()
  customerId: number;

  @ApiProperty({
    description: 'Refund amount in cents',
    example: 10000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Reason for the refund',
    enum: RefundReason,
    example: RefundReason.CUSTOMER_REQUEST,
  })
  @IsEnum(RefundReason)
  reason: RefundReason;

  @ApiProperty({
    description: 'Additional details about the refund reason',
    example: 'Customer requested refund due to scheduling conflict',
  })
  @IsString()
  reasonDetails: string;

  @ApiPropertyOptional({
    description: 'ID of the new order (if applicable)',
    example: 384,
  })
  @IsOptional()
  @IsNumber()
  newOrderId?: number;

  @ApiPropertyOptional({
    description: 'ID of the associated invoice (auto-found if not provided)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  invoiceId?: number;
}

export class ProcessRefundDto {
  @ApiPropertyOptional({
    description: 'Stripe refund ID (if processed through Stripe)',
    example: 're_1234567890',
  })
  @IsOptional()
  @IsString()
  stripeRefundId?: string;
}

export class CancelRefundDto {
  @ApiProperty({
    description: 'Reason for cancelling the refund',
    example: 'Customer changed mind',
  })
  @IsString()
  reason: string;
}

export class RefundQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by refund status',
    enum: RefundStatus,
    example: RefundStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @ApiPropertyOptional({
    description: 'Filter by refund reason',
    enum: RefundReason,
    example: RefundReason.CUSTOMER_REQUEST,
  })
  @IsOptional()
  @IsEnum(RefundReason)
  reason?: RefundReason;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 174,
  })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({
    description: 'Filter by original order ID',
    example: 383,
  })
  @IsOptional()
  @IsNumber()
  originalOrderId?: number;

  @ApiPropertyOptional({
    description: 'Start date for filtering (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of refunds to return',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of refunds to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
