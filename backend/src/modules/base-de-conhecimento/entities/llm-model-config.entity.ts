import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('llm_model_config')
export class LlmModelConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. 'classificacao' | 'composicao' | 'avaliacao' | 'embeddings'
  @Column({ type: 'varchar', unique: true })
  functionalityType: string;

  // 'openai' | 'anthropic'
  @Column({ type: 'varchar' })
  provider: string;

  // 'gpt-4o-mini' | 'claude-haiku-4-5' | 'text-embedding-3-small' etc.
  @Column({ type: 'varchar' })
  modelId: string;

  // env var name for API key, e.g. 'OPENAI_API_KEY'. null = use provider default env var
  @Column({ type: 'varchar', nullable: true })
  apiKeyEnvVar: string | null;

  @Column({ type: 'float', default: 0.3 })
  temperature: number;

  @Column({ type: 'int', nullable: true })
  maxTokens: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Self-referencing FK for fallback chain
  @Column({ type: 'uuid', nullable: true })
  fallbackConfigId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
