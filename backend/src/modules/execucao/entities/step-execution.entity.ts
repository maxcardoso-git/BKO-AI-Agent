import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { TicketExecution } from './ticket-execution.entity';
import { StepDefinition } from '../../orquestracao/entities/step-definition.entity';
import { Artifact } from './artifact.entity';
import { LlmCall } from './llm-call.entity';

export enum StepExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  WAITING_HUMAN = 'waiting_human',
}

@Entity('step_execution')
export class StepExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  stepKey: string;

  @Column({
    type: 'enum',
    enum: StepExecutionStatus,
    default: StepExecutionStatus.PENDING,
  })
  status: StepExecutionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @ManyToOne(() => TicketExecution, (te) => te.stepExecutions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticketExecutionId' })
  ticketExecution: TicketExecution;

  @Column({ type: 'uuid' })
  ticketExecutionId: string;

  @ManyToOne(() => StepDefinition, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stepDefinitionId' })
  stepDefinition: StepDefinition | null;

  @Column({ type: 'uuid', nullable: true })
  stepDefinitionId: string | null;

  @OneToMany(() => Artifact, (artifact) => artifact.stepExecution)
  artifacts: Artifact[];

  @OneToMany(() => LlmCall, (llmCall) => llmCall.stepExecution)
  llmCalls: LlmCall[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
