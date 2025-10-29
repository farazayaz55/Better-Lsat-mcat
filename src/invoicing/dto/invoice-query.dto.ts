import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus } from '../constants/invoice-status.constant';

export class InvoiceItemDto {
  @ApiProperty({
    description: 'Description of the invoice item',
    example: 'LSAT Prep Course - 10 Sessions',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price in cents',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Total price for this item in cents',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalPrice: number;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({
    description: 'New status for the invoice',
    enum: InvoiceStatus,
    example: InvoiceStatus.ISSUED,
  })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}

export class VoidInvoiceDto {
  @ApiProperty({
    description: 'Reason for voiding the invoice',
    example: 'Customer requested cancellation',
  })
  @IsString()
  reason: string;
}

export class InvoiceQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.PAID,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 174,
  })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({
    description: 'Filter by order ID',
    example: 383,
  })
  @IsOptional()
  @IsNumber()
  orderId?: number;

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
    description: 'Number of invoices to return',
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
    description: 'Number of invoices to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}
