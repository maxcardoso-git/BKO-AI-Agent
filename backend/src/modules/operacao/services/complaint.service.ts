import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from '../entities/complaint.entity';
import { ComplaintFilterDto } from '../dto/complaint-filter.dto';
import { ComplaintListResponse } from '../dto/complaint-list-response.dto';
import { TicketTimingEvent } from '../entities/ticket-timing-event.entity';
import { ComplaintUserNote } from '../entities/complaint-user-note.entity';
import { MandatoryInfoRule } from '../../regulatorio/entities/mandatory-info-rule.entity';
import { Artifact } from '../../execucao/entities/artifact.entity';
import { TimingMetricsDto } from '../dto/timing-metrics.dto';

/** Strip diacritics + lowercase so accent-mismatched substrings still match
 *  (e.g., "Descricao do Fato" rule vs "Descrição do Fato" draft text). */
function normalizeForMatch(input: string): string {
  return (input ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export interface ComplianceRecheckResult {
  complianceScore: number;
  isCompliant: boolean;
  totalRules: number;
  presentCount: number;
  mandatoryFieldsStatus: Array<{
    fieldName: string;
    fieldLabel: string;
    isPresent: boolean;
    excerpt: string | null;
  }>;
}

@Injectable()
export class ComplaintService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,

    @InjectRepository(TicketTimingEvent)
    private readonly ticketTimingEventRepo: Repository<TicketTimingEvent>,

    @InjectRepository(ComplaintUserNote)
    private readonly noteRepo: Repository<ComplaintUserNote>,

    @InjectRepository(MandatoryInfoRule)
    private readonly mandatoryRuleRepo: Repository<MandatoryInfoRule>,

    @InjectRepository(Artifact)
    private readonly artifactRepo: Repository<Artifact>,
  ) {}

  async findAll(filters: ComplaintFilterDto): Promise<ComplaintListResponse> {
    const {
      status,
      tipologyId,
      subtipologyId,
      situationId,
      riskLevel,
      isOverdue,
      search,
      createdAfter,
      createdBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    const qb = this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoinAndSelect('complaint.tipology', 'tipology')
      .leftJoinAndSelect('complaint.subtipology', 'subtipology')
      .leftJoinAndSelect('complaint.situation', 'situation')
      .leftJoinAndSelect('complaint.regulatoryAction', 'regulatoryAction');

    if (status) {
      qb.andWhere('complaint.status = :status', { status });
    }

    if (tipologyId) {
      qb.andWhere('complaint.tipologyId = :tipologyId', { tipologyId });
    }

    if (subtipologyId) {
      qb.andWhere('complaint.subtipologyId = :subtipologyId', { subtipologyId });
    }

    if (situationId) {
      qb.andWhere('complaint.situationId = :situationId', { situationId });
    }

    if (riskLevel) {
      qb.andWhere('complaint.riskLevel = :riskLevel', { riskLevel });
    }

    if (isOverdue !== undefined && isOverdue !== null) {
      const isOverdueBool = isOverdue === 'true';
      qb.andWhere('complaint.isOverdue = :isOverdue', { isOverdue: isOverdueBool });
    }

    if (search) {
      qb.andWhere(
        '(complaint.protocolNumber ILIKE :search OR complaint.rawText ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (createdAfter) {
      qb.andWhere('complaint.createdAt >= :createdAfter', { createdAfter });
    }

    if (createdBefore) {
      qb.andWhere('complaint.createdAt < :createdBefore', { createdBefore });
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'protocolNumber',
      'status',
      'riskLevel',
      'slaDeadline',
    ];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    qb.orderBy(`complaint.${safeSortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Search complaints by protocolNumber OR protocoloPrestadora (case-insensitive LIKE).
   */
  async findByProtocol(q: string): Promise<Complaint[]> {
    if (!q || q.trim().length === 0) return [];
    const pattern = `%${q.trim()}%`;
    return this.complaintRepository
      .createQueryBuilder('complaint')
      .where('LOWER(complaint.protocolNumber) LIKE LOWER(:pattern)', { pattern })
      .orWhere('LOWER(complaint.protocoloPrestadora) LIKE LOWER(:pattern)', { pattern })
      .orderBy('complaint.createdAt', 'DESC')
      .take(50)
      .getMany();
  }

  async findOne(id: string): Promise<Complaint> {
    const complaint = await this.complaintRepository
      .createQueryBuilder('complaint')
      .leftJoinAndSelect('complaint.tipology', 'tipology')
      .leftJoinAndSelect('complaint.subtipology', 'subtipology')
      .leftJoinAndSelect('complaint.situation', 'situation')
      .leftJoinAndSelect('complaint.regulatoryAction', 'regulatoryAction')
      .leftJoinAndSelect('complaint.details', 'details')
      .leftJoinAndSelect('complaint.history', 'history')
      .leftJoinAndSelect('complaint.attachments', 'attachments')
      .where('complaint.id = :id', { id })
      .getOne();

    if (!complaint) {
      throw new NotFoundException(`Complaint with id ${id} not found`);
    }

    return complaint;
  }

  async getTimingMetrics(complaintId: string): Promise<TimingMetricsDto> {
    // Verify complaint exists (throws 404 if missing)
    await this.findOne(complaintId);

    const events = await this.ticketTimingEventRepo.find({
      where: { complaintId },
      order: { occurredAt: 'ASC' },
    });

    const byMilestone = new Map<string, Date[]>();
    for (const e of events) {
      const list = byMilestone.get(e.milestone) ?? [];
      list.push(e.occurredAt);
      byMilestone.set(e.milestone, list);
    }
    const first = (m: string) => byMilestone.get(m)?.[0] ?? null;
    const last = (m: string) => {
      const arr = byMilestone.get(m);
      return arr && arr.length > 0 ? arr[arr.length - 1] : null;
    };
    const all = (m: string) => byMilestone.get(m) ?? [];
    const diffMs = (a: Date | null, b: Date | null) =>
      a && b ? b.getTime() - a.getTime() : null;

    // tempo_total: first event → last event
    const earliest = events[0]?.occurredAt ?? null;
    const latest = events.at(-1)?.occurredAt ?? null;
    const tempo_total = diffMs(earliest, latest);

    // tempo_sla: ticket_created → completed
    const tempo_sla = diffMs(first('ticket_created'), first('completed'));

    // tempo_revisao_humana: sum of all (paused_human → decision_made) pairs in chronological order
    const pauses = all('paused_human').map((d) => d.getTime());
    const decisions = all('decision_made').map((d) => d.getTime());
    let humanReviewMs = 0;
    let pairsFound = 0;
    for (let i = 0; i < Math.min(pauses.length, decisions.length); i++) {
      const delta = decisions[i] - pauses[i];
      if (delta > 0) {
        humanReviewMs += delta;
        pairsFound++;
      }
    }
    const tempo_revisao_humana = pairsFound > 0 ? humanReviewMs : null;

    // tempo_nota_a_processamento: most-recent note_saved → execution_started
    // NOTE: Always null after Phase 8 (no note_saved emission yet — see DTO doc comment).
    const tempo_nota_a_processamento = diffMs(last('note_saved'), first('execution_started'));

    // tempo_aprovacao_a_conclusao: approved → completed
    const tempo_aprovacao_a_conclusao = diffMs(first('approved'), first('completed'));

    return {
      tempo_total,
      tempo_sla,
      tempo_revisao_humana,
      tempo_nota_a_processamento,
      tempo_aprovacao_a_conclusao,
      events: events.map((e) => ({
        milestone: e.milestone,
        occurredAt: e.occurredAt.toISOString(),
        userId: e.userId,
      })),
    };
  }

  /**
   * Re-evaluates regulatory compliance based on the current operator note AND
   * the latest AI draft (or a caller-provided draftOverride for unsaved UI edits).
   * Cheap presence check (no LLM).
   *
   * A mandatory field is considered present when, across the combined haystack
   * of (note.parameters values + note.content + draft response text), normalized
   * to lowercase ASCII:
   *   - its fieldName appears as a non-empty key in note.parameters, OR
   *   - "<fieldName>:" appears as a "key: value" line anywhere, OR
   *   - its fieldLabel appears as a substring (accents stripped on both sides).
   */
  async recomputeCompliance(
    complaintId: string,
    draftOverride?: string,
  ): Promise<ComplianceRecheckResult> {
    const complaint = await this.complaintRepository.findOne({
      where: { id: complaintId },
      select: ['id', 'tipologyId', 'situationId'],
    });
    if (!complaint) throw new NotFoundException(`Complaint ${complaintId} not found`);

    const rules = complaint.tipologyId
      ? await this.mandatoryRuleRepo
          .createQueryBuilder('r')
          .where('r."isActive" = true')
          .andWhere('(r."tipologyId" = :tipologyId OR r."tipologyId" IS NULL)', {
            tipologyId: complaint.tipologyId,
          })
          .andWhere(
            complaint.situationId
              ? '(r."situationId" = :situationId OR r."situationId" IS NULL)'
              : 'r."situationId" IS NULL',
            complaint.situationId ? { situationId: complaint.situationId } : {},
          )
          .orderBy('r."sortOrder"', 'ASC')
          .getMany()
      : [];

    // Deduplicate by fieldName (most specific wins) — mirrors MandatoryInfoResolverService
    const deduped = new Map<string, MandatoryInfoRule>();
    for (const rule of rules) {
      const existing = deduped.get(rule.fieldName);
      const score = (r: MandatoryInfoRule) =>
        (r.tipologyId ? 1 : 0) + (r.situationId ? 2 : 0);
      if (!existing || score(rule) > score(existing)) {
        deduped.set(rule.fieldName, rule);
      }
    }
    const finalRules = Array.from(deduped.values()).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    // Latest active note version
    const note = await this.noteRepo.findOne({
      where: { complaintId, isActive: true },
      order: { version: 'DESC' },
    });

    // Latest AI draft. The draft IS what the operator is validating, so its
    // content must count toward presence — items like "Descricao do Fato",
    // "Providencia Adotada", "Data de Resolucao" are typically supplied by the
    // AI in the draft, not pre-typed by the operator.
    let draftText = draftOverride ?? '';
    if (!draftOverride) {
      const draftArtifact = await this.artifactRepo.findOne({
        where: { complaintId, artifactType: 'draft_response' },
        order: { createdAt: 'DESC' },
      });
      const draftResponse = (draftArtifact?.content?.['draftResponse'] as string) ?? '';
      draftText = draftResponse;
    }

    const params = (note?.parameters ?? {}) as Record<string, unknown>;
    const noteContent = note?.content ?? '';
    const paramValuesBlob = Object.values(params)
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v))
      .join('\n');

    // Combined haystack — what the operator effectively has on the screen.
    const haystack = [noteContent, paramValuesBlob, draftText].filter(Boolean).join('\n\n');
    const haystackNorm = normalizeForMatch(haystack);

    // Strip simple HTML tags from the draft so things like "<p>Descricao..."
    // still match. Tag stripping happens after normalization on the haystack
    // because normalize already replaces non-word noise — we only need to handle
    // the angle brackets here.
    const haystackStripped = haystackNorm.replace(/<[^>]*>/g, ' ');

    const mandatoryFieldsStatus = finalRules.map((rule) => {
      const paramValue = params[rule.fieldName];
      const hasParam =
        paramValue !== undefined &&
        paramValue !== null &&
        String(paramValue).trim().length > 0;

      // "fieldName: value" line — anywhere in the combined text
      const keyPattern = new RegExp(
        `(^|\\n|>)\\s*${rule.fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^\\n<]+)`,
        'i',
      );
      const keyMatch = (noteContent + '\n' + draftText).match(keyPattern);

      // fieldLabel substring — accents stripped so "Descricao" matches "Descrição"
      const labelMatch =
        !!rule.fieldLabel &&
        haystackStripped.includes(normalizeForMatch(rule.fieldLabel));

      const isPresent = hasParam || !!keyMatch || labelMatch;
      let excerpt: string | null = null;
      if (hasParam) {
        excerpt = String(paramValue).slice(0, 160);
      } else if (keyMatch) {
        excerpt = keyMatch[2]?.trim().slice(0, 160) ?? null;
      } else if (labelMatch && rule.fieldLabel) {
        // Extract a short snippet around the label match for context.
        const idx = haystackStripped.indexOf(normalizeForMatch(rule.fieldLabel));
        excerpt = idx >= 0 ? haystackStripped.slice(idx, idx + 120).trim() : null;
      }

      return {
        fieldName: rule.fieldName,
        fieldLabel: rule.fieldLabel,
        isPresent,
        excerpt,
      };
    });

    const totalRules = mandatoryFieldsStatus.length;
    const presentCount = mandatoryFieldsStatus.filter((f) => f.isPresent).length;
    const score = totalRules === 0 ? 1 : presentCount / totalRules;

    return {
      complianceScore: score,
      isCompliant: totalRules > 0 && presentCount === totalRules,
      totalRules,
      presentCount,
      mandatoryFieldsStatus,
    };
  }
}
