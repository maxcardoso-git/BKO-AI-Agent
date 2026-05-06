import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { LlmCall } from './llm-call.entity';

@Entity('token_usage')
export class TokenUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  promptTokens: number;

  @Column({ type: 'int' })
  completionTokens: number;

  @Column({ type: 'int' })
  totalTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  costUsd: number;

  @Column({ type: 'varchar' })
  model: string;

  @OneToOne(() => LlmCall, (llmCall) => llmCall.tokenUsage)
  llmCall: LlmCall;

  @CreateDateColumn()
  createdAt: Date;
}
