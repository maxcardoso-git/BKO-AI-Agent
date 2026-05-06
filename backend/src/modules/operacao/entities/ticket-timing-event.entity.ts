import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Complaint } from './complaint.entity';
import { TicketExecution } from '../../execucao/entities/ticket-execution.entity';

/**
 * Immutable audit trail of milestones reached during ticket processing.
 * No updatedAt — append-only, mirrors audit_log pattern from decision 01-02.
 * Lives under OperacaoModule (not ExecucaoModule) to avoid Phase 9 circular dep.
 */
@Entity('ticket_timing_event')
export class TicketTimingEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  complaintId: string;

  @Column({ type: 'uuid', nullable: true })
  executionId: string | null;

  @Column({ type: 'varchar', length: 50 })
  milestone: string;

  @Column({ type: 'timestamp with time zone' })
  occurredAt: Date;

  /** Null for automatic/system-generated events (see AUDIT-TIMING-05). */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Complaint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @ManyToOne(() => TicketExecution, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'executionId' })
  execution: TicketExecution | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
