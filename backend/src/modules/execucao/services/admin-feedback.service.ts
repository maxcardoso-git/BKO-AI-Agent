import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AdminFeedbackQueryDto, AdminFeedbackRowDto } from '../dto/admin-feedback.dto';

@Injectable()
export class AdminFeedbackService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(q: AdminFeedbackQueryDto): Promise<{ rows: AdminFeedbackRowDto[]; total: number }> {
    const params: unknown[] = [];
    const wheres: string[] = [];

    if (q.tipologyId) {
      params.push(q.tipologyId);
      wheres.push(`hfm."tipologyId" = $${params.length}`);
    }
    if (q.feedbackType) {
      params.push(q.feedbackType);
      wheres.push(`hfm."feedbackType" = $${params.length}`);
    }
    const whereSql = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

    // CRITICAL: push limit + offset to params array, use positional placeholders.
    // Defaults applied here (DTO defaults may not survive transformation in all NestJS configs):
    const limit = Math.min(500, Math.max(1, q.limit ?? 50));
    const offset = Math.max(0, q.offset ?? 0);
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rows = await this.dataSource.query(
      `SELECT hfm.id, hfm."complaintId", c."protocolNumber" AS "complaintProtocol",
              hfm."tipologyId", t.name AS "tipologyName",
              hfm."feedbackType", hfm."aiText", hfm."humanText", hfm."diffDescription",
              hfm."rejectionReason", hfm."correctionCategory", hfm."correctionWeight",
              hfm."createdAt"
       FROM "human_feedback_memory" hfm
       LEFT JOIN complaint c ON c.id = hfm."complaintId"
       LEFT JOIN tipology t ON t.id = hfm."tipologyId"
       ${whereSql}
       ORDER BY hfm."createdAt" DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    // COUNT query reuses only the filter params (not limit/offset)
    const countParams = params.slice(0, params.length - 2);
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*) AS c FROM "human_feedback_memory" hfm ${whereSql}`,
      countParams,
    );

    return { rows, total: Number(totalRows[0]?.c ?? 0) };
  }
}
