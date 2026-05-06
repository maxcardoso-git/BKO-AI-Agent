import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { Tipology } from '../../regulatorio/entities/tipology.entity';

@Entity('case_memory')
export class CaseMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text', nullable: true })
  decision: string | null;

  @Column({ type: 'varchar', nullable: true })
  outcome: string | null;

  @Column({ type: 'text', nullable: true })
  responseSnippet: string | null;

  // pgvector column for similarity search
  @Column({ type: 'vector', length: 1536 })
  embedding: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
