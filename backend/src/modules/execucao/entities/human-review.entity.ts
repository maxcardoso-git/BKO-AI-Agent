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
  CORRECTED = 'corrected',
}

@Entity('human_review')
export class HumanReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  reviewerUserId: string;

  @Column({ type: 'varchar', default: HumanReviewStatus.PENDING })
  status: HumanReviewStatus;

  @Column({ type: 'text' })
  aiGeneratedText: string;

  @Column({ type: 'text', nullable: true })
  humanFinalText: string | null;

  @Column({ type: 'text', nullable: true })
  diffSummary: string | null;

  @Column({ type: 'text', nullable: true })
  correctionReason: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'boolean', default: false })
  checklistCompleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  checklistItems: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  /** Operator's 1-3 star rating of the AI draft quality. Required for all
   *  decisions made via the validation UI; nullable for pre-rating rows. */
  @Column({ type: 'smallint', nullable: true })
  aiResponseRating: number | null;

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
