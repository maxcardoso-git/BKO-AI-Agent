import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Complaint } from '../entities/complaint.entity';
import { ComplaintFilterDto } from '../dto/complaint-filter.dto';
import { ComplaintListResponse } from '../dto/complaint-list-response.dto';
import { TicketTimingEvent } from '../entities/ticket-timing-event.entity';
import { TimingMetricsDto } from '../dto/timing-metrics.dto';

@Injectable()
export class ComplaintService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepository: Repository<Complaint>,

    @InjectRepository(TicketTimingEvent)
    private readonly ticketTimingEventRepo: Repository<TicketTimingEvent>,
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
}
