import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { StepExecution } from './step-execution.entity';
import { TokenUsage } from './token-usage.entity';

@Entity('llm_call')
export class LlmCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'int' })
  promptTokens: number;

  @Column({ type: 'int' })
  completionTokens: number;

  @Column({ type: 'int' })
  totalTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  costUsd: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'varchar', nullable: true })
  promptHash: string | null;

  @Column({ type: 'varchar' })
  responseStatus: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => StepExecution, (se) => se.llmCalls, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stepExecutionId' })
  stepExecution: StepExecution;

  @Column({ type: 'uuid' })
  stepExecutionId: string;

  @OneToOne(() => TokenUsage, (tu) => tu.llmCall, {
    nullable: true,
    cascade: true,
  })
  @JoinColumn({ name: 'tokenUsageId' })
  tokenUsage: TokenUsage | null;

  @Column({ type: 'uuid', nullable: true })
  tokenUsageId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
