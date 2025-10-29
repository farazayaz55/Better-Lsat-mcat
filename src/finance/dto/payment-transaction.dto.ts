import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';
import { TransactionType } from '../constants/finance.constant';

export class CreatePaymentTransactionDto {
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

  @ApiProperty({
    description: 'Type of transaction',
    enum: TransactionType,
    example: TransactionType.PAYMENT,
  })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    description: 'Transaction amount in cents',
    example: 10_000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'CAD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Payment method used',
    example: 'card',
  })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent ID',
    example: 'pi_1234567890',
  })
  @IsOptional()
  @IsString()
  stripePaymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Stripe charge ID',
    example: 'ch_1234567890',
  })
  @IsOptional()
  @IsString()
  stripeChargeId?: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'succeeded',
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { refundId: '123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiPropertyOptional({
    description: 'ID of the associated invoice',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  invoiceId?: number;
}
