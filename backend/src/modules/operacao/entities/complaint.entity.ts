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

  // --- Campos Anatel reais ---

  /** Modalidade Anatel: "Cobrança", "Plano de serviços, Oferta, Bônus..." */
  @Column({ type: 'varchar', nullable: true })
  modalidade: string | null;

  /** Motivo Anatel: "Cobrança de serviço não contratado", "Plano alterado indevidamente"... */
  @Column({ type: 'varchar', nullable: true })
  motivo: string | null;

  /** Serviço: "Celular Pós-Pago", "Celular Pré-Pago" */
  @Column({ type: 'varchar', nullable: true })
  servicoPrincipal: string | null;

  /** Canal de entrada: "Mobile App", "Usuário WEB", "Call Center", "WhatsApp" */
  @Column({ type: 'varchar', nullable: true })
  canalEntrada: string | null;

  /** Ação: "Nova", "Reaberta" */
  @Column({ type: 'varchar', nullable: true })
  acao: string | null;

  /** Perfil responsável / fila de roteamento: SKILL_CONTAS_POS, SKILL_GRE, SKILL_SQUAD */
  @Column({ type: 'varchar', nullable: true })
  perfilResponsavel: string | null;

  /** Resposta enviada pela operadora à Anatel */
  @Column({ type: 'text', nullable: true })
  resposta: string | null;

  /** Nome do cliente reclamante */
  @Column({ type: 'varchar', nullable: true })
  clienteNome: string | null;

  /** UF do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteUF: string | null;

  /** Cidade do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteCidade: string | null;

  /** Tipo de pessoa: PF / PJ */
  @Column({ type: 'varchar', nullable: true })
  clienteTipoPessoa: string | null;

  /** Nota de satisfação / Risco nota baixa */
  @Column({ type: 'decimal', precision: 5, scale: 3, nullable: true })
  nota: number | null;

  /** Protocolo interno da operadora */
  @Column({ type: 'varchar', nullable: true })
  protocoloPrestadora: string | null;

  /** Data de cadastro da reclamação na Anatel */
  @Column({ type: 'timestamp', nullable: true })
  dataCadastro: Date | null;

  /** Data de finalização na Anatel */
  @Column({ type: 'timestamp', nullable: true })
  dataFinalizacao: Date | null;

  /** Campos adicionais Anatel em JSON (motivos, situação focus, retido, etc.) */
  @Column({ type: 'jsonb', nullable: true })
  anatelMetadata: Record<string, unknown> | null;

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
