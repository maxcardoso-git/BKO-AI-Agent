import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tipology } from '../../regulatorio/entities/tipology.entity';

export enum StyleExpressionType {
  APPROVED = 'approved',
  FORBIDDEN = 'forbidden',
}

@Entity('style_memory')
export class StyleMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  expressionText: string;

  @Column({ type: 'enum', enum: StyleExpressionType })
  expressionType: StyleExpressionType;

  @Column({ type: 'text', nullable: true })
  context: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
