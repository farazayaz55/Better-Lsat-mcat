import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('automation_config')
export class AutomationConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Unique(['automationKey'])
  @Column({ type: 'varchar', length: 100 })
  automationKey: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  triggerEvent: string;

  @Column({ type: 'varchar', length: 20 })
  toolType: string;

  @Column({ type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
