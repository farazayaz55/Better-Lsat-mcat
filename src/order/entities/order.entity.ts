import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Items } from '../interfaces/item.interface';
import { StripeMetadata } from '../interfaces/stripe-metadata.interface';

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

  @Column({ type: 'json', nullable: true })
  stripe_meta: StripeMetadata;

  @Column({ type: 'timestamp', nullable: true })
  slot_reservation_expires_at: Date;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'RESERVED',
    nullable: true,
  })
  slot_reservation_status: 'RESERVED' | 'CONFIRMED' | 'EXPIRED';
}
