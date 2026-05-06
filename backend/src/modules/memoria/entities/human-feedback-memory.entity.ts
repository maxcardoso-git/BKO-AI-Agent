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

@Entity('human_feedback_memory')
export class HumanFeedbackMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  aiText: string;

  @Column({ type: 'text' })
  humanText: string;

  @Column({ type: 'text', nullable: true })
  diffDescription: string | null;

  @Column({ type: 'varchar', nullable: true })
  correctionCategory: string | null;

  @Column({ type: 'float', default: 1.0 })
  correctionWeight: number;

  // pgvector column for similarity on correction patterns
  @Column({ type: 'vector', length: 1536 })
  embedding: string;

  @ManyToOne(() => Complaint, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint | null;

  @Column({ type: 'uuid', nullable: true })
  complaintId: string | null;

  @ManyToOne(() => Tipology, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
