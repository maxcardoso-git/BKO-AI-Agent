import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Complaint } from './complaint.entity';

@Entity('complaint_attachment')
export class ComplaintAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'varchar' })
  fileType: string;

  @Column({ type: 'int' })
  fileSize: number;

  @Column({ type: 'varchar' })
  storagePath: string;

  @Column({ type: 'varchar', nullable: true })
  uploadedBy: string | null;

  @ManyToOne(() => Complaint, (complaint) => complaint.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'complaintId' })
  complaint: Complaint;

  @Column({ type: 'uuid' })
  complaintId: string;

  @CreateDateColumn()
  createdAt: Date;
}
