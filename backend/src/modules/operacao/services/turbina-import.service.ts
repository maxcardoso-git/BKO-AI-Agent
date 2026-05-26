import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Complaint, ComplaintStatus, ComplaintRiskLevel } from '../entities/complaint.entity';
import { Tipology } from '../../regulatorio/entities/tipology.entity';
import { TimingEventService } from './timing-event.service';

export interface TurbinaRow {
  Protocolo?: string | null;
  IdtSolicitacao?: string | null;
  IDInstancia?: string | null;
  IDTarefa?: string | null;
  Status?: string | null;
  DataDocumento?: string | null;
  DataEvento?: string | null;
  DataCadastro?: string | null;
  DataLimite?: string | null;
  DataResposta?: string | null;
  Servico?: string | null;
  PrimeiroServico?: string | null;
  Modalidade?: string | null;
  Motivo?: string | null;
  Acao?: string | null;
  QtdReabertura?: string | null;
  ResponsavelTabulacaoD0?: string | null;
  DataTabulacaoD0?: string | null;
  TelefoneContatoFixo?: string | null;
  TelefoneReclamado?: string | null;
  UFCliente?: string | null;
  CidadeCliente?: string | null;
  EnderecoCliente?: string | null;
  BairroCliente?: string | null;
  CPFCNPJCliente?: string | null;
  NomeCliente?: string | null;
  CPFCNPJAssinante?: string | null;
  NomeAssinante?: string | null;
  PerfilResponsavel?: string | null;
  Responsavel?: string | null;
  Supervisor?: string | null;
  Coordenador?: string | null;
  DescricaoReclamacao?: string | null;
  RespostaAnatel?: string | null;
  Justificativa?: string | null;
  Situacao?: string | null;
  PendenciaFutura?: string | null;
  MotivoPendenciaFutura?: string | null;
  DataPendenciaFutura?: string | null;
  CanalEntrada?: string | null;
  StatusProcesso?: string | null;
  DataFinalizado?: string | null;
  Retido?: string | null;
  MotivoRetencao?: string | null;
  DataIda?: string | null;
  TipoPessoa?: string | null;
  EmailCliente?: string | null;
  NumeroCRM?: string | null;
  MotivoReclamacao1?: string | null;
  MotivoReclamacao2?: string | null;
  MotivoReclamacao3?: string | null;
  MotivoProblema1?: string | null;
  MotivoProblema2?: string | null;
  MotivoProblema3?: string | null;
  MotivoSolucao1?: string | null;
  MotivoSolucao2?: string | null;
  MotivoSolucao3?: string | null;
  MotivoReincidente?: string | null;
  DetalhamentoMotivoReincidente?: string | null;
  SituacaoFocus?: string | null;
  UltimaIteracao?: string | null;
  Subservico?: string | null;
  ProtocoloPrestadora?: string | null;
  CEPCliente?: string | null;
  ServiceID?: string | null;
  Avaliacao?: string | null;
  Nota?: string | null;
  Resolvido?: string | null;
  RealizarIncentivo?: string | null;
  TelefoneWhatsapp?: string | null;
  SeloGovBr?: string | null;
  [key: string]: string | null | undefined;
}

export interface TurbinaImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ protocol: string | null; reason: string }>;
}

function clean(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim().replace(/^'/, '');
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return trimmed;
}

function parseDate(value: string | null | undefined): Date | null {
  const v = clean(value);
  if (!v) return null;
  // Formats: "dd/MM/yyyy HH:mm:ss" or "dd/MM/yyyy"
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) {
    // Try ISO fallback
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, dd, MM, yyyy, hh = '00', mm = '00', ss = '00'] = m;
  const iso = `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}-03:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function parseBool(value: string | null | undefined): boolean | null {
  const v = clean(value);
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === 'sim' || lower === 'true' || lower === '1') return true;
  if (lower === 'não' || lower === 'nao' || lower === 'false' || lower === '0') return false;
  return null;
}

function parseInt0(value: string | null | undefined): number | null {
  const v = clean(value);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function parseDecimal(value: string | null | undefined): number | null {
  const v = clean(value);
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

@Injectable()
export class TurbinaImportService {
  private readonly logger = new Logger(TurbinaImportService.name);

  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Tipology)
    private readonly tipologyRepo: Repository<Tipology>,
    private readonly timingEventService: TimingEventService,
  ) {}

  /**
   * Imports a batch of rows from the Turbina CSV.
   * - Skips rows whose protocolNumber already exists.
   * - Maps Modalidade → Tipology (by case-insensitive label/key match) with fallback to a tipology
   *   whose key is 'outros' (auto-created if missing).
   * - Returns count of imported / skipped / errors.
   */
  async importBatch(rows: TurbinaRow[]): Promise<TurbinaImportResult> {
    const result: TurbinaImportResult = { imported: 0, skipped: 0, errors: [] };

    // 1. Filter rows with a protocol
    const valid = rows.filter((r) => clean(r.Protocolo));
    if (valid.length === 0) return result;

    // 2. Check existing protocols in one query
    const protocols = Array.from(new Set(valid.map((r) => clean(r.Protocolo)!).filter(Boolean)));
    const existing = await this.complaintRepo.find({
      where: { protocolNumber: In(protocols) },
      select: ['protocolNumber'],
    });
    const existingSet = new Set(existing.map((c) => c.protocolNumber));

    // 3. Resolve tipologies in one query
    const tipologies = await this.tipologyRepo.find();
    const tipologyByLabel = new Map<string, Tipology>();
    tipologies.forEach((t) => {
      tipologyByLabel.set(t.label.toLowerCase(), t);
      tipologyByLabel.set(t.key.toLowerCase(), t);
    });
    let fallbackTipology = tipologies.find((t) => t.key.toLowerCase() === 'outros') ?? null;
    if (!fallbackTipology) {
      try {
        fallbackTipology = await this.tipologyRepo.save(
          this.tipologyRepo.create({
            key: 'outros',
            label: 'Outros',
            slaBusinessDays: 10,
            isActive: true,
          }),
        );
      } catch (err) {
        this.logger.warn(`Could not create fallback tipology 'outros': ${err}`);
      }
    }

    // 4. Build entities to insert
    const entitiesToInsert: Complaint[] = [];
    for (const row of valid) {
      const protocolNumber = clean(row.Protocolo)!;
      if (existingSet.has(protocolNumber)) {
        result.skipped += 1;
        continue;
      }

      const modalidade = clean(row.Modalidade);
      const tipology: Tipology | null =
        (modalidade ? tipologyByLabel.get(modalidade.toLowerCase()) : undefined) ?? fallbackTipology;

      const rawText = clean(row.DescricaoReclamacao) ?? '';

      try {
        const entity = this.complaintRepo.create({
          protocolNumber,
          rawText,
          status: ComplaintStatus.PENDING,
          riskLevel: ComplaintRiskLevel.LOW,
          source: 'turbina_import',
          tipologyId: tipology?.id ?? null,
          slaBusinessDays: tipology?.slaBusinessDays ?? null,
          slaDeadline: parseDate(row.DataLimite),
          idtSolicitacao: clean(row.IdtSolicitacao),
          idInstancia: clean(row.IDInstancia),
          idTarefa: clean(row.IDTarefa),
          dataDocumento: parseDate(row.DataDocumento),
          dataEvento: parseDate(row.DataEvento),
          dataCadastro: parseDate(row.DataCadastro),
          dataResposta: parseDate(row.DataResposta),
          dataFinalizacao: parseDate(row.DataFinalizado),
          servicoPrincipal: clean(row.Servico),
          primeiroServico: clean(row.PrimeiroServico),
          modalidade,
          motivo: clean(row.Motivo),
          acao: clean(row.Acao),
          qtdReabertura: parseInt0(row.QtdReabertura),
          responsavelTabulacaoD0: clean(row.ResponsavelTabulacaoD0),
          dataTabulacaoD0: parseDate(row.DataTabulacaoD0),
          telefoneContatoFixo: clean(row.TelefoneContatoFixo),
          telefoneReclamado: clean(row.TelefoneReclamado),
          clienteUF: clean(row.UFCliente),
          clienteCidade: clean(row.CidadeCliente),
          clienteEndereco: clean(row.EnderecoCliente),
          clienteBairro: clean(row.BairroCliente),
          cpfCnpjCliente: clean(row.CPFCNPJCliente),
          clienteNome: clean(row.NomeCliente),
          cpfCnpjAssinante: clean(row.CPFCNPJAssinante),
          nomeAssinante: clean(row.NomeAssinante),
          perfilResponsavel: clean(row.PerfilResponsavel),
          responsavel: clean(row.Responsavel),
          supervisor: clean(row.Supervisor),
          coordenador: clean(row.Coordenador),
          justificativa: clean(row.Justificativa),
          situacaoAnatel: clean(row.Situacao),
          pendenciaFutura: clean(row.PendenciaFutura),
          motivoPendenciaFutura: clean(row.MotivoPendenciaFutura),
          dataPendenciaFutura: parseDate(row.DataPendenciaFutura),
          canalEntrada: clean(row.CanalEntrada),
          statusProcesso: clean(row.StatusProcesso),
          retido: parseBool(row.Retido),
          motivoRetencao: clean(row.MotivoRetencao),
          dataIda: parseDate(row.DataIda),
          clienteTipoPessoa: clean(row.TipoPessoa),
          clienteEmail: clean(row.EmailCliente),
          numeroCrm: clean(row.NumeroCRM),
          motivoReclamacao1: clean(row.MotivoReclamacao1),
          motivoReclamacao2: clean(row.MotivoReclamacao2),
          motivoReclamacao3: clean(row.MotivoReclamacao3),
          motivoProblema1: clean(row.MotivoProblema1),
          motivoProblema2: clean(row.MotivoProblema2),
          motivoProblema3: clean(row.MotivoProblema3),
          motivoSolucao1: clean(row.MotivoSolucao1),
          motivoSolucao2: clean(row.MotivoSolucao2),
          motivoSolucao3: clean(row.MotivoSolucao3),
          motivoReincidente: clean(row.MotivoReincidente),
          detalhamentoMotivoReincidente: clean(row.DetalhamentoMotivoReincidente),
          situacaoFocus: clean(row.SituacaoFocus),
          ultimaIteracao: clean(row.UltimaIteracao),
          subservico: clean(row.Subservico),
          protocoloPrestadora: clean(row.ProtocoloPrestadora),
          clienteCep: clean(row.CEPCliente),
          serviceId: clean(row.ServiceID),
          avaliacao: clean(row.Avaliacao),
          nota: parseDecimal(row.Nota),
          resolvido: parseBool(row.Resolvido),
          realizarIncentivo: clean(row.RealizarIncentivo),
          telefoneWhatsapp: clean(row.TelefoneWhatsapp),
          seloGovBr: clean(row.SeloGovBr),
        });
        entitiesToInsert.push(entity);
      } catch (err) {
        result.errors.push({ protocol: protocolNumber, reason: String(err) });
      }
    }

    if (entitiesToInsert.length > 0) {
      try {
        // chunked save for performance; TypeORM chunk option splits inserts
        const saved = await this.complaintRepo.save(entitiesToInsert, { chunk: 100 });
        result.imported = saved.length;

        // Emit ticket_created timing event (idempotent) so /admin/audit/timings can compute tempo_total / tempo_sla
        for (const c of saved) {
          try {
            await this.timingEventService.emitOnce(
              'ticket_created',
              c.id,
              null,
              null,
              c.createdAt ?? new Date(),
            );
          } catch (e) {
            this.logger.warn(`ticket_created emit failed for ${c.protocolNumber}: ${e}`);
          }
        }
      } catch (err) {
        this.logger.error(`Bulk save failed: ${err}`);
        result.errors.push({ protocol: null, reason: `bulk save failed: ${err}` });
      }
    }

    return result;
  }
}
