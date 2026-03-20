import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('resource')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  // API_HTTP | DATABASE | WEBSOCKET | OTHER
  @Column({ type: 'varchar', default: 'API_HTTP' })
  type: string;

  // LLM | NONE
  @Column({ type: 'varchar', default: 'NONE' })
  subtype: string;

  // Only relevant when subtype = LLM
  @Column({ type: 'varchar', nullable: true })
  llmProvider: string | null;

  @Column({ type: 'varchar', nullable: true })
  llmModel: string | null;

  @Column({ type: 'varchar', nullable: true })
  endpoint: string | null;

  // GET | POST | PUT | PATCH | DELETE
  @Column({ type: 'varchar', default: 'POST' })
  httpMethod: string;

  // NONE | BEARER_TOKEN | API_KEY | BASIC_AUTH
  @Column({ type: 'varchar', default: 'NONE' })
  authMode: string;

  @Column({ type: 'text', nullable: true })
  bearerToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  apiKeyHeader: string | null;

  @Column({ type: 'text', nullable: true })
  apiKeyValue: string | null;

  @Column({ type: 'varchar', nullable: true })
  basicUser: string | null;

  @Column({ type: 'text', nullable: true })
  basicPassword: string | null;

  @Column({ type: 'jsonb', nullable: true })
  connectionJson: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  configurationJson: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadataJson: Record<string, unknown> | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  // PROD | HML | DEV
  @Column({ type: 'varchar', default: 'PROD' })
  environment: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
