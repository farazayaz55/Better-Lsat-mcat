import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { User } from '../../user/entities/user.entity';
import { Items } from '../interfaces/item.interface';
import { StripeMetadata } from '../interfaces/stripe-metadata.interface';
import { SlotReservationStatus } from '../constants/slot-reservation-status.constant';

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

  @Column({ type: 'json' })
  items: Items;

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
}
