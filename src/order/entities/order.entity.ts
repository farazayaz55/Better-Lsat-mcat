import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Items } from '../interfaces/item.interface';

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
}
