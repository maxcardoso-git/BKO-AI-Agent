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

@Entity('persona')
export class Persona {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  formalityLevel: number;

  @Column({ type: 'int' })
  empathyLevel: number;

  @Column({ type: 'int' })
  assertivenessLevel: number;

  @Column({ type: 'text', array: true, nullable: true })
  requiredExpressions: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  forbiddenExpressions: string[] | null;

  /** Free-text generation brief appended to the LLM system prompt for both
   *  draft generation and smart-note rewrites. Lets admins steer the IA per
   *  tipology (char caps, structure rules, where to inject inside the IQI). */
  @Column({ type: 'text', nullable: true })
  instructions: string | null;

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
