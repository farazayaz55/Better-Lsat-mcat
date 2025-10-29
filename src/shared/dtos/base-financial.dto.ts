import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FINANCIAL_CONSTANTS } from '../constants/financial.constant';

/**
 * Base DTO for financial operations
 */
export class BaseFinancialDto {
  @ApiProperty({
    description: 'Amount in cents',
    example: 10000,
    minimum: FINANCIAL_CONSTANTS.MIN_AMOUNT,
  })
  @IsNumber()
  @Min(FINANCIAL_CONSTANTS.MIN_AMOUNT)
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'CAD',
    default: FINANCIAL_CONSTANTS.DEFAULT_CURRENCY,
  })
  @IsOptional()
  @IsString()
  currency?: string;
}

/**
 * Base DTO for order-related operations
 */
export class BaseOrderRelatedDto extends BaseFinancialDto {
  @ApiProperty({
    description: 'ID of the associated order',
    example: 383,
  })
  @IsNumber()
  orderId: number;

  @ApiProperty({
    description: 'ID of the customer',
    example: 174,
  })
  @IsNumber()
  customerId: number;
}

/**
 * Base query DTO for financial entities
 */
export class BaseFinancialQueryDto {
  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Number of records to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Start date for filtering (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for filtering (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}
