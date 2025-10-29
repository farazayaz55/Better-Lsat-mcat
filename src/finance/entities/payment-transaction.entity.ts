import { Entity, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { BaseOrderRelatedEntity } from '../../shared/entities/base-financial.entity';
import { TransactionType } from '../constants/finance.constant';

@Entity('payment_transactions')
@Index(['transactionNumber'], { unique: true })
@Index(['orderId'])
@Index(['customerId'])
@Index(['type'])
@Index(['status'])
@Index(['createdAt'])
export class PaymentTransaction extends BaseOrderRelatedEntity {
  @ApiProperty({
    description: 'Unique transaction number',
    example: 'TRN-20250115-0001',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  transactionNumber: string;

  @ApiPropertyOptional({
    description: 'ID of the associated invoice',
    example: 1,
  })
  @Column({ type: 'int', nullable: true })
  invoiceId?: number;

  @ApiProperty({
    description: 'Type of transaction',
    enum: TransactionType,
    example: TransactionType.PAYMENT,
  })
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'Payment method used',
    example: 'card',
  })
  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @ApiPropertyOptional({
    description: 'Stripe payment intent ID',
    example: 'pi_1234567890',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  stripePaymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Stripe charge ID',
    example: 'ch_1234567890',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  stripeChargeId?: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'succeeded',
  })
  @Column({ type: 'varchar', length: 50 })
  status: string;

  @ApiPropertyOptional({
    description:
      'Additional metadata. NOTE: amount field is subtotal (no tax). Tax is in metadata.taxAmount',
    example: {
      taxAmount: 1441,
      totalAmountIncludingTax: 13941,
      invoiceSubtotal: 12500,
      paidCurrency: 'INR',
      convertedToCad: true,
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    taxAmount?: number;
    totalAmountIncludingTax?: number;
    invoiceSubtotal?: number;
    paidCurrency?: string;
    convertedToCad?: boolean;
    [key: string]: unknown;
  };
}
