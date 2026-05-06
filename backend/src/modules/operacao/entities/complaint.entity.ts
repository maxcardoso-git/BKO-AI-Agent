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

  /** Subserviço: ex "Conta/Cobrança", "Dados e Voz movel" */
  @Column({ type: 'varchar', nullable: true })
  subservico: string | null;

  /** Email do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteEmail: string | null;

  /** CEP do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteCep: string | null;

  /** Bairro do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteBairro: string | null;

  /** Endereço do cliente */
  @Column({ type: 'varchar', nullable: true })
  clienteEndereco: string | null;

  /** Quantidade de reaberturas */
  @Column({ type: 'int', nullable: true })
  qtdReabertura: number | null;

  /** Retido (cliente foi retido?) */
  @Column({ type: 'boolean', nullable: true })
  retido: boolean | null;

  /** Motivo da retenção */
  @Column({ type: 'varchar', nullable: true })
  motivoRetencao: string | null;

  /** Situação Focus */
  @Column({ type: 'varchar', nullable: true })
  situacaoFocus: string | null;

  /** "A reclamação foi considerada": "Procedente com contato", "Improcedente com contato", etc. */
  @Column({ type: 'varchar', nullable: true })
  reclamacaoConsiderada: string | null;

  /** Satisfação do cliente */
  @Column({ type: 'varchar', nullable: true })
  satisfacaoCliente: string | null;

  /** Reclamação resolvida? */
  @Column({ type: 'boolean', nullable: true })
  resolvido: boolean | null;

  /** Selo GOV BR */
  @Column({ type: 'varchar', nullable: true })
  seloGovBr: string | null;

  /** Motivo Reclamação 1/2/3 */
  @Column({ type: 'varchar', nullable: true })
  motivoReclamacao1: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoReclamacao2: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoReclamacao3: string | null;

  /** Motivo Problema 1/2/3 */
  @Column({ type: 'varchar', nullable: true })
  motivoProblema1: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoProblema2: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoProblema3: string | null;

  /** Motivo Solução 1/2/3 */
  @Column({ type: 'varchar', nullable: true })
  motivoSolucao1: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoSolucao2: string | null;
  @Column({ type: 'varchar', nullable: true })
  motivoSolucao3: string | null;

  /** Data Resposta */
  @Column({ type: 'timestamp', nullable: true })
  dataResposta: Date | null;

  /** Número CRM da prestadora */
  @Column({ type: 'varchar', nullable: true })
  numeroCrm: string | null;

  /** Service ID externo */
  @Column({ type: 'varchar', nullable: true })
  serviceId: string | null;

  // --- Campos adicionais Anatel ---

  /** IdtSolicitação — ID da solicitação Anatel */
  @Column({ type: 'varchar', nullable: true })
  idtSolicitacao: string | null;

  /** ID Instância */
  @Column({ type: 'varchar', nullable: true })
  idInstancia: string | null;

  /** ID Tarefa */
  @Column({ type: 'varchar', nullable: true })
  idTarefa: string | null;

  /** Data de Documento */
  @Column({ type: 'timestamp', nullable: true })
  dataDocumento: Date | null;

  /** Data Evento */
  @Column({ type: 'timestamp', nullable: true })
  dataEvento: Date | null;

  /** Primeiro Serviço — serviço no momento do cadastro original */
  @Column({ type: 'varchar', nullable: true })
  primeiroServico: string | null;

  /** Responsável Tabulação D0 */
  @Column({ type: 'varchar', nullable: true })
  responsavelTabulacaoD0: string | null;

  /** Data Tabulação D0 */
  @Column({ type: 'timestamp', nullable: true })
  dataTabulacaoD0: Date | null;

  /** Telefone Contato Fixo */
  @Column({ type: 'varchar', nullable: true })
  telefoneContatoFixo: string | null;

  /** Telefone Reclamado */
  @Column({ type: 'varchar', nullable: true })
  telefoneReclamado: string | null;

  /** CPF/CNPJ Cliente */
  @Column({ type: 'varchar', nullable: true })
  cpfCnpjCliente: string | null;

  /** CPF/CNPJ Assinante */
  @Column({ type: 'varchar', nullable: true })
  cpfCnpjAssinante: string | null;

  /** Nome Assinante (titular da linha) */
  @Column({ type: 'varchar', nullable: true })
  nomeAssinante: string | null;

  /** Responsável — atendente */
  @Column({ type: 'varchar', nullable: true })
  responsavel: string | null;

  /** Supervisor */
  @Column({ type: 'varchar', nullable: true })
  supervisor: string | null;

  /** Coordenador */
  @Column({ type: 'varchar', nullable: true })
  coordenador: string | null;

  /** Justificativa da resposta */
  @Column({ type: 'text', nullable: true })
  justificativa: string | null;

  /** Situação Anatel: "Aberta", "Fechado" */
  @Column({ type: 'varchar', nullable: true })
  situacaoAnatel: string | null;

  /** Pendência Futura */
  @Column({ type: 'varchar', nullable: true })
  pendenciaFutura: string | null;

  /** Motivo Pendência Futura */
  @Column({ type: 'varchar', nullable: true })
  motivoPendenciaFutura: string | null;

  /** Data Pendência Futura */
  @Column({ type: 'timestamp', nullable: true })
  dataPendenciaFutura: Date | null;

  /** Status Processo Anatel: "Finalizado", "Em andamento" */
  @Column({ type: 'varchar', nullable: true })
  statusProcesso: string | null;

  /** Data Ida */
  @Column({ type: 'timestamp', nullable: true })
  dataIda: Date | null;

  /** Motivo Reincidente */
  @Column({ type: 'varchar', nullable: true })
  motivoReincidente: string | null;

  /** Detalhamento Motivo Reincidente */
  @Column({ type: 'varchar', nullable: true })
  detalhamentoMotivoReincidente: string | null;

  /** Última Iteração — protocolo da iteração anterior */
  @Column({ type: 'varchar', nullable: true })
  ultimaIteracao: string | null;

  /** Avaliação qualitativa */
  @Column({ type: 'varchar', nullable: true })
  avaliacao: string | null;

  /** Realizar Incentivo */
  @Column({ type: 'varchar', nullable: true })
  realizarIncentivo: string | null;

  /** Telefone WhatsApp */
  @Column({ type: 'varchar', nullable: true })
  telefoneWhatsapp: string | null;

  /** Id Pronta Para Contato */
  @Column({ type: 'varchar', nullable: true })
  idProntaParaContato: string | null;

  /** Data Envio Pode Falar Agora */
  @Column({ type: 'timestamp', nullable: true })
  dataEnvioPodeFalarAgora: Date | null;

  /** Data Retorno Falar Agora */
  @Column({ type: 'timestamp', nullable: true })
  dataRetornoFalarAgora: Date | null;

  /** Retorno em Horário Operacional */
  @Column({ type: 'varchar', nullable: true })
  retornoHorarioOperacional: string | null;

  /** Retorno Falar Agora */
  @Column({ type: 'varchar', nullable: true })
  retornoFalarAgora: string | null;

  /** Cliente Favorável? */
  @Column({ type: 'varchar', nullable: true })
  clienteFavoravel: string | null;

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
