import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { User } from '../../user/entities/user.entity';
import { Items } from '../interfaces/item.interface';
import { StripeMetadata } from '../interfaces/stripe-metadata.interface';
import { OrderAppointment, OrderTag } from './order-appointment.entity';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';

export enum OrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('order')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  // Foreign key to User (Customer)
  @ManyToOne(() => User, (user) => user.orders, { eager: true })
  @JoinColumn({ name: 'customerId' }) // FK column name in DB
  customer: User;

  @Column()
  customerId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json' })
  items: Items;

  @ApiPropertyOptional({
    description: 'Currency code for the order',
    example: 'CAD',
  })
  @Column({ type: 'varchar', length: 3, default: 'CAD' })
  currency: string;

  @ApiPropertyOptional({
    description:
      'Stripe payment metadata including session info, payment status, and webhook data',
    type: StripeMetadata,
    nullable: true,
  })
  @Column({ type: 'json', nullable: true })
  stripe_meta: StripeMetadata;

  @ApiProperty({
    description: 'Slot reservation expiration timestamp',
    example: '2024-01-15T14:30:00.000Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @Column({ type: 'timestamp', nullable: true })
  slot_reservation_expires_at: Date;

  @ApiProperty({
    description:
      'Slot reservation status indicating the current state of the reservation',
    enum: SlotReservationStatus,
    example: SlotReservationStatus.RESERVED,
    type: 'string',
    nullable: true,
  })
  @Column({
    type: 'varchar',
    length: 20,
    default: SlotReservationStatus.RESERVED,
    nullable: true,
  })
  slot_reservation_status: SlotReservationStatus;

  @ApiPropertyOptional({
    description:
      'Google Meet link shared across all calendar events in this order',
    example: 'https://meet.google.com/abc-defg-hij',
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  googleMeetLink?: string;

  // Optional relations for invoicing (lazy-loaded to maintain backward compatibility)
  @OneToOne('Invoice', 'order', { lazy: true })
  invoice: Promise<unknown>;

  @OneToMany('Refund', 'originalOrder', { lazy: true })
  refunds: Promise<unknown[]>;

  @OneToOne('PaymentTransaction', 'order', { lazy: true })
  transaction: Promise<unknown>;

  @ApiPropertyOptional({ description: 'Free-form notes about the order' })
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ApiPropertyOptional({
    description: 'Derived tags summarizing attendance across appointments',
    isArray: true,
    enum: OrderTag,
  })
  @Column({ type: 'enum', enum: OrderTag, array: true, nullable: true })
  tags?: OrderTag[] | null;

  @OneToMany(() => OrderAppointment, (appt) => appt.order, { cascade: true })
  appointments?: OrderAppointment[];

  @ApiPropertyOptional({
    description: 'Business status of the order',
    enum: OrderStatus,
  })
  @Column({
    name: 'order_status',
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  orderStatus: OrderStatus;

  @ApiPropertyOptional({
    description: 'Timestamp when the order was marked as completed',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;
}
