import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Order } from './order.entity';

export enum OrderAppointmentAttendanceStatus {
  UNKNOWN = 'UNKNOWN',
  SHOWED = 'SHOWED',
  NO_SHOW = 'NO_SHOW',
}

@Entity('order_appointment')
@Index(['orderId'])
@Index(['orderId', 'slotDateTime'])
@Index(['assignedEmployeeId', 'slotDateTime'])
export class OrderAppointment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: number;

  @ApiProperty({ description: 'Order item/product ID for which this appointment is created' })
  @Column({ type: 'int' })
  itemId: number;

  @ApiProperty({ description: 'ISO datetime string of the appointment slot' })
  @Column({ type: 'timestamptz' })
  slotDateTime: Date;

  @ApiPropertyOptional({ description: 'Assigned employee ID for this appointment' })
  @Column({ type: 'int', nullable: true })
  assignedEmployeeId?: number | null;

  @ApiProperty({ enum: OrderAppointmentAttendanceStatus })
  @Column({
    type: 'enum',
    enum: OrderAppointmentAttendanceStatus,
    default: OrderAppointmentAttendanceStatus.UNKNOWN,
  })
  attendanceStatus: OrderAppointmentAttendanceStatus;

  @ApiPropertyOptional({ description: 'When the attendance was marked' })
  @Column({ type: 'timestamptz', nullable: true })
  attendanceMarkedAt?: Date | null;

  @ApiPropertyOptional({ description: 'User ID who marked the attendance' })
  @Column({ type: 'int', nullable: true })
  attendanceMarkedBy?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum OrderTag {
  SHOWED = 'SHOWED',
  NO_SHOW = 'NO_SHOW',
}


