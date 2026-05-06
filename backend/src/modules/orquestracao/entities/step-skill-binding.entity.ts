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
import { SkillDefinition } from './skill-definition.entity';

@Entity('step_skill_binding')
export class StepSkillBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  llmModel: string | null;

  @Column({ type: 'varchar', nullable: true })
  promptVersion: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => StepDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepDefinitionId' })
  stepDefinition: StepDefinition;

  @Column({ type: 'uuid' })
  stepDefinitionId: string;

  @ManyToOne(() => SkillDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillDefinitionId' })
  skillDefinition: SkillDefinition;

  @Column({ type: 'uuid' })
  skillDefinitionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
