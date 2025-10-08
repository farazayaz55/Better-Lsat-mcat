import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Article } from '../../article/entities/article.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ nullable: true })
  password: string;

  @Unique('username', ['username'])
  @Column({ length: 200, nullable: true })
  username: string;

  @Column('simple-array')
  roles: string[];

  @Column()
  isAccountDisabled: boolean;

  @Unique('email', ['email'])
  @Column({ length: 200 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column('json', { nullable: true })
  workHours: Record<string, string[]> = {
    Monday: ['09:00-20:00'],
    Tuesday: ['09:00-20:00'],
    Wednesday: ['09:00-20:00'],
    Thursday: ['09:00-20:00'],
    Friday: ['09:00-20:00'],
  }; // Work Hours in format "HH:MM-HH:MM" for employees

  @Column('simple-array', { nullable: true })
  serviceIds: number[] = [5, 6, 7, 8]; // Service IDs this employee can work on

  @Column({ default: 0 })
  lastAssignedOrderCount: number; // For round-robin assignment

  @CreateDateColumn({ name: 'createdAt', nullable: true })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', nullable: true })
  updatedAt: Date;

  @OneToMany(() => Article, (article) => article.author)
  articles: Article[];

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];
}
