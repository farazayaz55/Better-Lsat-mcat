import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Invoice } from '../../invoicing/entities/invoice.entity';
import { RefundStatus, RefundReason } from '../constants/finance.constant';
import { Order } from '../../order/entities/order.entity';
import { User } from '../../user/entities/user.entity';

@Entity('refunds')
@Index(['refundNumber'], { unique: true })
@Index(['originalOrderId'])
@Index(['customerId'])
@Index(['status'])
@Index(['createdAt'])
export class Refund {
  @ApiProperty({
    description: 'Unique identifier',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Unique refund number',
    example: 'REF-20250115-0001',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  refundNumber: string;

  @ApiProperty({
    description: 'ID of the original order being refunded',
    example: 383,
  })
  @Column({ type: 'int' })
  originalOrderId: number;

  @ApiPropertyOptional({
    description: 'ID of the new order (if applicable)',
    example: 384,
  })
  @Column({ type: 'int', nullable: true })
  newOrderId?: number;

  @ApiProperty({
    description: 'ID of the associated invoice',
    example: 1,
  })
  @Column({ type: 'int' })
  invoiceId: number;

  @ApiProperty({
    description: 'ID of the customer',
    example: 174,
  })
  @Column({ type: 'int' })
  customerId: number;

  @ApiProperty({
    description: 'Amount in cents',
    example: 10000,
  })
  @Column({ type: 'bigint' })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'CAD',
  })
  @Column({ type: 'varchar', length: 3, default: 'CAD' })
  currency: string;

  @ApiPropertyOptional({
    description: 'Additional metadata including currency conversion details',
    example: {
      refundAmountInCad: 10000,
      refundAmountInPaymentCurrency: 62500,
      originalPaymentCurrency: 'INR',
    },
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    refundAmountInCad?: number;
    refundAmountInPaymentCurrency?: number;
    originalPaymentCurrency?: string;
    [key: string]: unknown;
  };

  @ApiProperty({
    description: 'Reason for the refund',
    enum: RefundReason,
    example: RefundReason.CUSTOMER_REQUEST,
  })
  @Column({
    type: 'enum',
    enum: RefundReason,
  })
  reason: RefundReason;

  @ApiProperty({
    description: 'Additional details about the refund reason',
    example: 'Customer requested refund due to scheduling conflict',
  })
  @Column({ type: 'text' })
  reasonDetails: string;

  @ApiPropertyOptional({
    description: 'Stripe refund ID (if processed through Stripe)',
    example: 're_1234567890',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  stripeRefundId?: string;

  @ApiProperty({
    description: 'Current status of the refund',
    enum: RefundStatus,
    example: RefundStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.PENDING,
  })
  status: RefundStatus;

  @ApiPropertyOptional({
    description: 'Date when the refund was processed',
    example: '2024-01-20T10:30:00Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  refundedAt?: Date;

  @ApiPropertyOptional({
    description: 'ID of the user who initiated this operation',
    example: 123,
  })
  @Column({ type: 'int', nullable: true })
  initiatedBy?: number;

  @ApiPropertyOptional({
    description: 'ID of the user who last processed this operation',
    example: 124,
  })
  @Column({ type: 'int', nullable: true })
  processedBy?: number;

  @ApiProperty({
    description: 'Date when the record was created',
    example: '2024-01-15T10:30:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the record was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Order, { lazy: true })
  @JoinColumn({ name: 'originalOrderId' })
  originalOrder: Promise<Order>;

  @ManyToOne(() => Order, { lazy: true })
  @JoinColumn({ name: 'newOrderId' })
  newOrder?: Promise<Order>;

  @ManyToOne(() => Invoice, { lazy: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: Promise<Invoice>;

  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'customerId' })
  customer: Promise<User>;

  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'initiatedBy' })
  initiator?: Promise<User>;

  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'processedBy' })
  processor?: Promise<User>;
}
