import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Complaint } from './complaint.entity';

@Entity('complaint_detail')
export class ComplaintDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  fieldName: string;

  @Column({ type: 'text' })
  fieldValue: string;

  @Column({ type: 'varchar' })
  fieldType: string;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar' })
  source: string;

  @ManyToOne(() => Complaint, (complaint) => complaint.details, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
