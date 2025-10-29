import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('automation_log')
export class AutomationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  automationKey: string;

  @Column({ type: 'varchar', length: 50 })
  triggerEvent: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  toolType: string;

  @Column({ type: 'json', nullable: true })
  eventData: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  executedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
