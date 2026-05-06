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
import { Situation } from './situation.entity';

export enum RegulatoryRuleType {
  SLA = 'sla',
  MANDATORY_FIELD = 'mandatory_field',
  ACTION_CONDITION = 'action_condition',
  BLOCKING = 'blocking',
  INFORMATIONAL = 'informational',
}

@Entity('regulatory_rule')
export class RegulatoryRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  sourceDocument: string;

  @Column({ type: 'varchar', nullable: true })
  sourceSection: string | null;

  @Column({ type: 'enum', enum: RegulatoryRuleType })
  ruleType: RegulatoryRuleType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @ManyToOne(() => Situation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'situationId' })
  situation: Situation | null;

  @Column({ type: 'uuid', nullable: true })
  situationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
