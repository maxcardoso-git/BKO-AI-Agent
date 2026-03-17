import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StepExecution } from './step-execution.entity';
import { Complaint } from '../../operacao/entities/complaint.entity';

@Entity('artifact')
export class Artifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  artifactType: string;

  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => StepExecution, (se) => se.artifacts, {
    onDelete: 'CASCADE',
  })
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
}
