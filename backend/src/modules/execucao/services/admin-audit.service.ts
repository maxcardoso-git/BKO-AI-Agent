import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminAuditTimingsQueryDto, AuditTimingRowDto } from '../dto/audit-timings.dto';

@Injectable()
export class AdminAuditService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(
    q: AdminAuditTimingsQueryDto,
  ): Promise<{ rows: AuditTimingRowDto[]; total: number }> {
    const params: unknown[] = [];
    const wheres: string[] = [];

    if (q.tipologyId) {
      params.push(q.tipologyId);
      wheres.push(`c."tipologyId" = $${params.length}`);
    }
    if (q.periodStart) {
      params.push(q.periodStart);
      wheres.push(`c."createdAt" >= $${params.length}`);
    }
    if (q.periodEnd) {
      params.push(q.periodEnd);
      wheres.push(`c."createdAt" <= $${params.length}`);
    }
    if (q.userRole) {
      params.push(q.userRole);
      wheres.push(`u.role = $${params.length}`);
    }
    const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

    const limit = Math.min(500, Math.max(1, q.limit ?? 100));
    const offset = Math.max(0, q.offset ?? 0);
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const raw = await this.dataSource.query(
      `SELECT
         c.id AS "complaintId",
         c."protocolNumber",
         t.name AS "tipologyName",
         u.name AS "responsavelFinalName",
         u.role AS "responsavelFinalRole",
         c."createdAt",
         c."slaDeadline",
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='ticket_created') AS ev_created,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='note_saved') AS ev_note,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='execution_started') AS ev_started,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='paused_human') AS ev_paused,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='decision_made') AS ev_decision,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='approved') AS ev_approved,
         (SELECT MIN("occurredAt") FROM ticket_timing_event WHERE "complaintId"=c.id AND milestone='completed') AS ev_completed
       FROM complaint c
       LEFT JOIN tipology t ON t.id = c."tipologyId"
       LEFT JOIN "user" u ON u.id = c."responsavelFinal"
       ${whereSql}
       ORDER BY c."createdAt" DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    const countParams = params.slice(0, params.length - 2);
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*) AS c FROM complaint c
       LEFT JOIN "user" u ON u.id = c."responsavelFinal"
       ${whereSql}`,
      countParams,
    );

    const diffMin = (a: string | Date | null, b: string | Date | null): number | null => {
      if (!a || !b) return null;
      return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);
    };

    const rows: AuditTimingRowDto[] = raw.map(
      (r: {
        complaintId: string;
        protocolNumber: string;
        tipologyName: string | null;
        responsavelFinalName: string | null;
        responsavelFinalRole: string | null;
        createdAt: string;
        slaDeadline: string | null;
        ev_created: string | null;
        ev_note: string | null;
        ev_started: string | null;
        ev_paused: string | null;
        ev_decision: string | null;
        ev_approved: string | null;
        ev_completed: string | null;
      }) => ({
        complaintId: r.complaintId,
        protocolNumber: r.protocolNumber,
        tipologyName: r.tipologyName,
        responsavelFinalName: r.responsavelFinalName,
        responsavelFinalRole: r.responsavelFinalRole,
        createdAt: r.createdAt,
        finishedAt: r.ev_completed,
        tempoTotalMin: diffMin(r.ev_completed, r.ev_created),
        tempoSlaMin:
          r.slaDeadline && r.ev_completed
            ? diffMin(r.slaDeadline, r.ev_completed) // positive = within SLA, negative = late
            : null,
        tempoRevisaoHumanaMin: diffMin(r.ev_decision, r.ev_paused),
        tempoNotaParaProcessamentoMin: diffMin(r.ev_started, r.ev_note),
        tempoAprovacaoParaConclusaoMin: diffMin(r.ev_completed, r.ev_approved),
      }),
    );

    return { rows, total: Number(totalRows[0]?.c ?? 0) };
  }
}
