import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../constants/invoice-status.constant';
import { Order } from '../../order/entities/order.entity';
import { User } from '../../user/entities/user.entity';

@Entity('invoices')
@Index(['invoiceNumber'], { unique: true })
@Index(['orderId'])
@Index(['customerId'])
@Index(['status'])
@Index(['issueDate'])
export class Invoice {
  @ApiProperty({
    description: 'Unique identifier',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Unique invoice number',
    example: 'INV-20250115-0001',
  })
  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber: string;

  @ApiProperty({
    description: 'ID of the associated order',
    example: 383,
  })
  @Column({ type: 'int' })
  orderId: number;

  @ApiProperty({
    description: 'ID of the customer',
    example: 174,
  })
  @Column({ type: 'int' })
  customerId: number;

  @ApiProperty({
    description: 'Current status of the invoice',
    enum: InvoiceStatus,
    example: InvoiceStatus.PAID,
  })
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @ApiProperty({
    description: 'Date when the invoice was issued',
    example: '2024-01-15',
  })
  @Column({ type: 'date' })
  issueDate: Date;

  @ApiProperty({
    description: 'Date when the invoice payment is due',
    example: '2024-02-15',
  })
  @Column({ type: 'date' })
  dueDate: Date;

  @ApiPropertyOptional({
    description: 'Date when the invoice was paid',
    example: '2024-01-15',
  })
  @Column({ type: 'date', nullable: true })
  paidDate?: Date;

  @ApiProperty({
    description: 'Invoice items in JSON format',
    example: [
      {
        description: 'LSAT Prep Course',
        quantity: 1,
        unitPrice: 10000,
        totalPrice: 10000,
      },
    ],
  })
  @Column({ type: 'jsonb' })
  items: any[];

  @ApiProperty({
    description: 'Subtotal amount in cents',
    example: 10000,
  })
  @Column({ type: 'bigint' })
  subtotal: number;

  @ApiProperty({
    description: 'Tax amount in cents',
    example: 1000,
  })
  @Column({ type: 'bigint', default: 0 })
  tax: number;

  @ApiProperty({
    description: 'Discount amount in cents',
    example: 500,
  })
  @Column({ type: 'bigint', default: 0 })
  discount: number;

  @ApiProperty({
    description: 'Total amount in cents',
    example: 10500,
  })
  @Column({ type: 'bigint' })
  total: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the invoice',
    example: 'Thank you for your business!',
  })
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date when the invoice was voided',
    example: '2024-01-20T10:30:00Z',
  })
  @Column({ type: 'timestamp', nullable: true })
  voidedAt?: Date;

  @ApiPropertyOptional({
    description: 'Reason for voiding the invoice',
    example: 'Customer requested cancellation',
  })
  @Column({ type: 'text', nullable: true })
  voidReason?: string;

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
  @JoinColumn({ name: 'orderId' })
  order: Promise<Order>;

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
