import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Complaint } from './complaint.entity';

@Entity('complaint_history')
export class ComplaintHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  previousStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  newStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  performedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => Complaint, (complaint) => complaint.history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @CreateDateColumn()
  createdAt: Date;
}
