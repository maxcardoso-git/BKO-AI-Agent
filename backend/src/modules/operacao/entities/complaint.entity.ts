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
import { Tipology } from '../../regulatorio/entities/tipology.entity';
import { Subtipology } from '../../regulatorio/entities/subtipology.entity';
import { Situation } from '../../regulatorio/entities/situation.entity';
import { RegulatoryAction } from '../../regulatorio/entities/regulatory-action.entity';
import { ComplaintDetail } from './complaint-detail.entity';
import { ComplaintHistory } from './complaint-history.entity';
import { ComplaintAttachment } from './complaint-attachment.entity';

export enum ComplaintStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  WAITING_HUMAN = 'waiting_human',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ComplaintRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('complaint')
export class Complaint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  protocolNumber: string;

  @Column({ type: 'text' })
  rawText: string;

  @Column({ type: 'text', nullable: true })
  normalizedText: string | null;

  @Column({
    type: 'enum',
    enum: ComplaintStatus,
    default: ComplaintStatus.PENDING,
  })
  status: ComplaintStatus;

  @Column({
    type: 'enum',
    enum: ComplaintRiskLevel,
    default: ComplaintRiskLevel.LOW,
  })
  riskLevel: ComplaintRiskLevel;

  @Column({ type: 'timestamp', nullable: true })
  slaDeadline: Date | null;

  @Column({ type: 'int', nullable: true })
  slaBusinessDays: number | null;

  @Column({ type: 'boolean', default: false })
  isOverdue: boolean;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  @Column({ type: 'boolean', nullable: true })
  procedente: boolean | null;

  @ManyToOne(() => Tipology, { nullable: true, eager: false })
  @JoinColumn({ name: 'tipologyId' })
  tipology: Tipology | null;

  @Column({ type: 'uuid', nullable: true })
  tipologyId: string | null;

  @ManyToOne(() => Subtipology, { nullable: true, eager: false })
  @JoinColumn({ name: 'subtipologyId' })
  subtipology: Subtipology | null;

  @Column({ type: 'uuid', nullable: true })
  subtipologyId: string | null;

  @ManyToOne(() => Situation, { nullable: true, eager: false })
  @JoinColumn({ name: 'situationId' })
  situation: Situation | null;

  @Column({ type: 'uuid', nullable: true })
  situationId: string | null;

  @ManyToOne(() => RegulatoryAction, { nullable: true, eager: false })
  @JoinColumn({ name: 'regulatoryActionId' })
  regulatoryAction: RegulatoryAction | null;

  @Column({ type: 'uuid', nullable: true })
  regulatoryActionId: string | null;

  @OneToMany(() => ComplaintDetail, (detail) => detail.complaint)
  details: ComplaintDetail[];

  @OneToMany(() => ComplaintHistory, (history) => history.complaint)
  history: ComplaintHistory[];

  @OneToMany(() => ComplaintAttachment, (attachment) => attachment.complaint)
  attachments: ComplaintAttachment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
