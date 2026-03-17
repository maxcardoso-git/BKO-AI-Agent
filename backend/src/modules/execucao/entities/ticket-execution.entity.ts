import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Complaint } from '../../operacao/entities/complaint.entity';
import { CapabilityVersion } from '../../orquestracao/entities/capability-version.entity';
import { StepExecution } from './step-execution.entity';

export enum TicketExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED_HUMAN = 'paused_human',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('ticket_execution')
export class TicketExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TicketExecutionStatus,
    default: TicketExecutionStatus.PENDING,
  })
  status: TicketExecutionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  currentStepKey: string | null;

  @Column({ type: 'int', nullable: true })
  totalDurationMs: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @ManyToOne(() => CapabilityVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'capabilityVersionId' })
  capabilityVersion: CapabilityVersion;

  @Column({ type: 'uuid' })
  capabilityVersionId: string;

  @OneToMany(() => StepExecution, (step) => step.ticketExecution)
  stepExecutions: StepExecution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
