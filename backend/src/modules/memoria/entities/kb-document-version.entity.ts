import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { KbDocument } from './kb-document.entity';
import { KbChunk } from './kb-chunk.entity';

@Entity('kb_document_version')
export class KbDocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text', nullable: true })
  changeDescription: string | null;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => KbDocument, (doc) => doc.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: KbDocument;

  @Column({ type: 'uuid' })
  documentId: string;

  @OneToMany(() => KbChunk, (chunk) => chunk.documentVersion)
  chunks: KbChunk[];

  @CreateDateColumn()
  createdAt: Date;
}
