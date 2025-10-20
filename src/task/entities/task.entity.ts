import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { User } from '../../user/entities/user.entity';

export enum TaskLabel {
  MEETING = 'meeting',
  PERSONAL = 'personal',
  PREPARATION = 'preparation',
  GRADING = 'grading',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Task ID', example: 1 })
  id: number;

  @Column({ length: 200 })
  @ApiProperty({ description: 'Task title', example: 'Prepare lesson materials' })
  title: string;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional({ description: 'Task description', example: 'Review chapter 5 and prepare exercises' })
  description: string;

  @Column({ type: 'timestamp' })
  @ApiProperty({ description: 'Task start date and time', example: '2024-01-15T14:00:00.000Z' })
  startDateTime: Date;

  @Column({ type: 'timestamp' })
  @ApiProperty({ description: 'Task end date and time', example: '2024-01-15T15:00:00.000Z' })
  endDateTime: Date;

  @Column()
  @ApiProperty({ description: 'Tutor ID who created this task', example: 1 })
  tutorId: number;

  @ManyToOne(() => User, (user) => user.tasks, { eager: true })
  @JoinColumn({ name: 'tutorId' })
  @ApiProperty({ description: 'Tutor who created this task', type: User })
  tutor: User;

  @Column({ nullable: true })
  @ApiPropertyOptional({ description: 'Google Calendar event ID', example: 'abc123def456' })
  googleCalendarEventId: string;

  @Column({
    type: 'enum',
    enum: TaskLabel,
  })
  @ApiProperty({ description: 'Task label', enum: TaskLabel, example: TaskLabel.MEETING })
  label: TaskLabel;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  @ApiProperty({ description: 'Task priority', enum: TaskPriority, example: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  @ApiProperty({ description: 'Task status', enum: TaskStatus, example: TaskStatus.PENDING })
  status: TaskStatus;

  @CreateDateColumn({ name: 'createdAt' })
  @ApiProperty({ description: 'Task creation timestamp', example: '2024-01-15T10:00:00.000Z' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  @ApiProperty({ description: 'Task last update timestamp', example: '2024-01-15T12:00:00.000Z' })
  updatedAt: Date;
}
