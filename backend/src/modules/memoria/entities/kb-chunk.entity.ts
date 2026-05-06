import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KbDocumentVersion } from './kb-document-version.entity';

@Entity('kb_chunk')
export class KbChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  chunkIndex: number;

  @Column({ type: 'varchar', nullable: true })
  sectionTitle: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  // pgvector column — stored as string; pgvector handles conversion
  @Column({ type: 'vector', length: 1536 })
  embedding: string;

  @ManyToOne(() => KbDocumentVersion, (version) => version.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentVersionId' })
  documentVersion: KbDocumentVersion;

  @Column({ type: 'uuid' })
  documentVersionId: string;

  @CreateDateColumn()
  createdAt: Date;
}
