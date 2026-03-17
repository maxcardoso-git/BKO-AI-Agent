import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tipology } from './tipology.entity';

@Entity('subtipology')
export class Subtipology {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Tipology, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology;

  @Column({ type: 'uuid' })
  tipologyId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
