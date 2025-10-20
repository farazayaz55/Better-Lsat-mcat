import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Order } from '../../order/entities/order.entity';
import { Task } from '../../task/entities/task.entity';

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

  @Column({ nullable: true })
  ghlUserId: string;

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

  @OneToMany(() => Order, (order) => order.customer)
  orders: Order[];

  @OneToMany(() => Task, (task) => task.tutor)
  tasks: Task[];
}
