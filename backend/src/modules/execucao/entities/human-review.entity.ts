import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StepExecution } from './step-execution.entity';
import { Complaint } from '../../operacao/entities/complaint.entity';

export enum HumanReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested',
}

@Entity('human_review')
export class HumanReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  reviewerUserId: string;

  @Column({
    type: 'enum',
    enum: HumanReviewStatus,
    default: HumanReviewStatus.PENDING,
  })
  status: HumanReviewStatus;

  @Column({ type: 'text' })
  aiGeneratedText: string;

  @Column({ type: 'text', nullable: true })
  humanFinalText: string | null;

  @Column({ type: 'text', nullable: true })
  diffSummary: string | null;

  @Column({ type: 'text', nullable: true })
  correctionReason: string | null;

  @Column({ type: 'boolean', default: false })
  checklistCompleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  checklistItems: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => StepExecution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepExecutionId' })
  stepExecution: StepExecution;

  @Column({ type: 'uuid' })
  stepExecutionId: string;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
