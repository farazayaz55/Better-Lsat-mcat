import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Order } from '../../order/entities/order.entity';
import { User } from '../../user/entities/user.entity';
import { FINANCIAL_CONSTANTS } from '../constants/financial.constant';

/**
 * Base class for all financial entities
 */
export abstract class BaseFinancialEntity {
  @ApiProperty({
    description: 'Unique identifier',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Amount in cents',
    example: 10000,
  })
  @Column({ type: 'bigint' })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  @Column({
    type: 'varchar',
    length: FINANCIAL_CONSTANTS.CURRENCY_LENGTH,
    default: FINANCIAL_CONSTANTS.DEFAULT_CURRENCY,
  })
  currency: string;

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
}

/**
 * Base class for entities related to orders
 */
export abstract class BaseOrderRelatedEntity extends BaseFinancialEntity {
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
