import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column()
  price: number;

  @Column()
  sessions: number; // number of sessions in the product

  @Column()
  save: number;

  @Column()
  Duration: number;

  @Column({ type: 'text' })
  Description: string;

  @Column({ type: 'json', nullable: true })
  badge: { text: string; color: string } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
