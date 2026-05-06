import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StepDefinition } from './step-definition.entity';

@Entity('step_transition_rule')
export class StepTransitionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conditionType: string;

  @Column({ type: 'jsonb' })
  conditionExpression: Record<string, unknown>;

  @Column({ type: 'varchar' })
  targetStepKey: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => StepDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepDefinitionId' })
  stepDefinition: StepDefinition;

  @Column({ type: 'uuid' })
  stepDefinitionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
