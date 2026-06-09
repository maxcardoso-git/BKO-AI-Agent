import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  tipologyKey?: string;
  decision?: 'approved' | 'corrected' | 'rejected';
  rating?: number;
  page?: number;
  limit?: number;
}

export interface TicketAnalyticsRow {
  complaintId: string;
  protocolNumber: string;
  createdAt: string;
  dataDocumento: string | null;
  riskLevel: string | null;
  tipologyKey: string | null;
  tipologyLabel: string | null;
  tipologyConfidence: number | null;
  propensityScore: number | null;
  emotionalTone: string | null;
  hasLegalThreat: boolean;
  hasSocialMediaThreat: boolean;
  hasPriorComplaints: boolean;
  complianceScore: number | null;
  isCompliant: boolean | null;
  iqiTemplateName: string | null;
  tmtMs: number | null;
  /** First-screen time (ms): ticket opened (lock acquired) → "Processar" clicked. */
  firstScreenMs: number | null;
  /** Second-screen time (ms): AI response shown (paused_human) → operator decision. */
  secondScreenMs: number | null;
  aiResponseRating: number | null;
  decision: string | null;
  reviewedAt: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
}

export interface TicketAnalyticsList {
  rows: TicketAnalyticsRow[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Paginated per-ticket view of all the AI analyses we keep around: sentiment,
   * tipology classification, compliance evaluation, IQI template choice, plus
   * human review outcome (decision + star rating) and end-to-end TMT.
   *
   * One row per complaint. Joins the latest artifact of each relevant type and
   * the latest human_review. Designed for the /admin/analises table.
   */
  async listTickets(filters: AnalyticsFilters): Promise<TicketAnalyticsList> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const offset = (page - 1) * limit;

    const params: unknown[] = [
      filters.from ?? null,
      filters.to ?? null,
      filters.tipologyKey ?? null,
      filters.decision ?? null,
      filters.rating ?? null,
    ];

    // Date range filters on the ANATEL complaint date (dataDocumento), not the
    // import time. `to` is end-of-day inclusive (< to + 1 day) to avoid the
    // off-by-one that excluded the selected day.
    const whereSql = `
      WHERE ($1::date IS NULL OR c."dataDocumento" >= $1::date)
        AND ($2::date IS NULL OR c."dataDocumento" < ($2::date + INTERVAL '1 day'))
        AND ($3::text IS NULL OR t.key = $3)
        AND ($4::text IS NULL OR lr.status = $4)
        AND ($5::int IS NULL OR lr."aiResponseRating" = $5)
    `;

    const baseCte = `
      WITH artifacts_pivot AS (
        SELECT
          a."complaintId",
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'customer_sentiment'))[1] AS sentiment,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'typology_classification'))[1] AS typology_class,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'compliance_evaluation'))[1] AS compliance,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'iqi_template'))[1] AS iqi
        FROM artifact a
        WHERE a."artifactType" IN (
          'customer_sentiment','typology_classification','compliance_evaluation','iqi_template'
        )
        GROUP BY a."complaintId"
      ),
      latest_review AS (
        SELECT DISTINCT ON ("complaintId")
          "complaintId", "aiResponseRating", status, "reviewedAt", "reviewerUserId"
        FROM human_review
        WHERE "reviewedAt" IS NOT NULL
        ORDER BY "complaintId", "reviewedAt" DESC
      ),
      exec_milestones AS (
        SELECT
          te.id AS execution_id,
          te."complaintId" AS complaint_id,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'execution_started') AS started_at,
          MAX(tte."occurredAt") FILTER (WHERE tte.milestone = 'approved') AS approved_at,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'paused_human') AS paused_at,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'decision_made') AS decided_at
        FROM ticket_execution te
        LEFT JOIN ticket_timing_event tte ON tte."executionId" = te.id
        GROUP BY te.id, te."complaintId"
      ),
      tmt_per_complaint AS (
        SELECT
          em.complaint_id AS "complaintId",
          EXTRACT(EPOCH FROM (em.approved_at - em.started_at)) * 1000 AS tmt_ms,
          -- First screen: lock acquisition → execution_started. ticket_lock keeps a
          -- single row per complaint (DELETE+INSERT on acquire), so lockedAt is the
          -- latest grab; only count it when it precedes the start to avoid negatives
          -- from a re-acquire during /validar.
          CASE
            WHEN tl."lockedAt" IS NOT NULL AND em.started_at IS NOT NULL
              AND tl."lockedAt" <= em.started_at
            THEN EXTRACT(EPOCH FROM (em.started_at - tl."lockedAt")) * 1000
            ELSE NULL
          END AS first_screen_ms,
          -- Second screen: AI response shown (paused_human) → operator decision.
          CASE
            WHEN em.paused_at IS NOT NULL AND em.decided_at IS NOT NULL
              AND em.decided_at > em.paused_at
            THEN EXTRACT(EPOCH FROM (em.decided_at - em.paused_at)) * 1000
            ELSE NULL
          END AS second_screen_ms
        FROM exec_milestones em
        LEFT JOIN ticket_lock tl ON tl."complaintId" = em.complaint_id
      )
    `;

    const rowsSql = `
      ${baseCte}
      SELECT
        c.id AS complaint_id,
        c."protocolNumber" AS protocol_number,
        c."createdAt" AS created_at,
        c."dataDocumento" AS data_documento,
        c."riskLevel" AS risk_level,
        t.key AS tipology_key,
        t.label AS tipology_label,
        (ap.typology_class ->> 'confidence')::float AS tipology_confidence,
        (ap.sentiment ->> 'propensityScore')::float AS propensity_score,
        ap.sentiment ->> 'emotionalTone' AS emotional_tone,
        COALESCE((ap.sentiment ->> 'hasLegalThreat')::boolean, false) AS has_legal_threat,
        COALESCE((ap.sentiment ->> 'hasSocialMediaThreat')::boolean, false) AS has_social_media_threat,
        COALESCE((ap.sentiment ->> 'hasPriorComplaints')::boolean, false) AS has_prior_complaints,
        (ap.compliance ->> 'complianceScore')::float AS compliance_score,
        (ap.compliance ->> 'isCompliant')::boolean AS is_compliant,
        ap.iqi ->> 'templateName' AS iqi_template_name,
        tmt.tmt_ms,
        tmt.first_screen_ms,
        tmt.second_screen_ms,
        lr."aiResponseRating" AS rating,
        lr.status AS decision,
        lr."reviewedAt" AS reviewed_at,
        lr."reviewerUserId" AS reviewer_user_id,
        u.name AS reviewer_name,
        u.email AS reviewer_email
      FROM complaint c
      LEFT JOIN tipology t ON t.id = c."tipologyId"
      LEFT JOIN artifacts_pivot ap ON ap."complaintId" = c.id
      LEFT JOIN latest_review lr ON lr."complaintId" = c.id
      LEFT JOIN "user" u ON u.id::text = lr."reviewerUserId"
      LEFT JOIN tmt_per_complaint tmt ON tmt."complaintId" = c.id
      ${whereSql}
      ORDER BY c."dataDocumento" DESC NULLS LAST, c."createdAt" DESC
      LIMIT $6 OFFSET $7
    `;

    const countSql = `
      ${baseCte}
      SELECT COUNT(*)::int AS total
      FROM complaint c
      LEFT JOIN tipology t ON t.id = c."tipologyId"
      LEFT JOIN latest_review lr ON lr."complaintId" = c.id
      ${whereSql}
    `;

    const [rawRows, countRows] = await Promise.all([
      this.dataSource.query(rowsSql, [...params, limit, offset]),
      this.dataSource.query(countSql, params),
    ]);

    const rows: TicketAnalyticsRow[] = (rawRows as Record<string, unknown>[]).map((r) => ({
      complaintId: String(r.complaint_id),
      protocolNumber: String(r.protocol_number),
      createdAt: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : String(r.created_at ?? ''),
      dataDocumento:
        r.data_documento instanceof Date
          ? (r.data_documento as Date).toISOString()
          : r.data_documento != null
            ? String(r.data_documento)
            : null,
      riskLevel: r.risk_level as string | null,
      tipologyKey: r.tipology_key as string | null,
      tipologyLabel: r.tipology_label as string | null,
      tipologyConfidence: r.tipology_confidence != null ? Number(r.tipology_confidence) : null,
      propensityScore: r.propensity_score != null ? Number(r.propensity_score) : null,
      emotionalTone: r.emotional_tone as string | null,
      hasLegalThreat: Boolean(r.has_legal_threat),
      hasSocialMediaThreat: Boolean(r.has_social_media_threat),
      hasPriorComplaints: Boolean(r.has_prior_complaints),
      complianceScore: r.compliance_score != null ? Number(r.compliance_score) : null,
      isCompliant: r.is_compliant != null ? Boolean(r.is_compliant) : null,
      iqiTemplateName: r.iqi_template_name as string | null,
      tmtMs: r.tmt_ms != null ? Number(r.tmt_ms) : null,
      firstScreenMs: r.first_screen_ms != null ? Number(r.first_screen_ms) : null,
      secondScreenMs: r.second_screen_ms != null ? Number(r.second_screen_ms) : null,
      aiResponseRating: r.rating != null ? Number(r.rating) : null,
      decision: r.decision as string | null,
      reviewedAt:
        r.reviewed_at instanceof Date
          ? (r.reviewed_at as Date).toISOString()
          : r.reviewed_at != null
            ? String(r.reviewed_at)
            : null,
      reviewerUserId: r.reviewer_user_id as string | null,
      reviewerName: r.reviewer_name as string | null,
      reviewerEmail: r.reviewer_email as string | null,
    }));

    const total = Number((countRows as Array<{ total: number }>)[0]?.total ?? 0);

    return { rows, total, page, limit };
  }

  /**
   * Full per-ticket breakdown for the drill-down detail page. Returns the same
   * shape as listTickets() plus the raw artifact contents (sentiment block,
   * typology details, compliance violations, IQI template, draft, final
   * response) and human-review fields (correction reason, observations).
   */
  async getTicketDetail(complaintId: string): Promise<Record<string, unknown> | null> {
    const baseRows = await this.dataSource.query(
      `WITH artifacts_pivot AS (
        SELECT
          a."complaintId",
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'customer_sentiment'))[1] AS sentiment,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'typology_classification'))[1] AS typology_class,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'compliance_evaluation'))[1] AS compliance,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'iqi_template'))[1] AS iqi,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'draft_response'))[1] AS draft_response,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC)
            FILTER (WHERE a."artifactType" = 'final_response'))[1] AS final_response
        FROM artifact a
        WHERE a."complaintId" = $1
        GROUP BY a."complaintId"
      ),
      latest_review AS (
        SELECT
          "complaintId", "aiResponseRating", status, "reviewedAt", "reviewerUserId",
          "humanFinalText", "correctionReason", "rejectionReason", observations
        FROM human_review
        WHERE "complaintId" = $1 AND "reviewedAt" IS NOT NULL
        ORDER BY "reviewedAt" DESC
        LIMIT 1
      ),
      tmt_per_complaint AS (
        SELECT
          te."complaintId",
          EXTRACT(EPOCH FROM (
            (SELECT MAX(tte1."occurredAt") FROM ticket_timing_event tte1
              WHERE tte1."executionId" = te.id AND tte1.milestone = 'approved')
            -
            (SELECT MIN(tte2."occurredAt") FROM ticket_timing_event tte2
              WHERE tte2."executionId" = te.id AND tte2.milestone = 'execution_started')
          )) * 1000 AS tmt_ms
        FROM ticket_execution te
        WHERE te."complaintId" = $1
        ORDER BY te."createdAt" DESC
        LIMIT 1
      )
      SELECT
        c.id AS complaint_id,
        c."protocolNumber" AS protocol_number,
        c."protocoloPrestadora" AS protocol_internal,
        c."createdAt" AS created_at,
        c."riskLevel" AS risk_level,
        c."rawText" AS raw_text,
        c."clienteNome" AS cliente_nome,
        c."cpfCnpjCliente" AS cpf_cnpj_cliente,
        t.key AS tipology_key,
        t.label AS tipology_label,
        ap.sentiment, ap.typology_class, ap.compliance, ap.iqi,
        ap.draft_response, ap.final_response,
        lr."aiResponseRating" AS rating,
        lr.status AS decision,
        lr."reviewedAt" AS reviewed_at,
        lr."reviewerUserId" AS reviewer_user_id,
        lr."humanFinalText" AS human_final_text,
        lr."correctionReason" AS correction_reason,
        lr."rejectionReason" AS rejection_reason,
        lr.observations AS review_observations,
        u.name AS reviewer_name,
        u.email AS reviewer_email,
        tmt.tmt_ms
      FROM complaint c
      LEFT JOIN tipology t ON t.id = c."tipologyId"
      LEFT JOIN artifacts_pivot ap ON ap."complaintId" = c.id
      LEFT JOIN latest_review lr ON lr."complaintId" = c.id
      LEFT JOIN "user" u ON u.id::text = lr."reviewerUserId"
      LEFT JOIN tmt_per_complaint tmt ON tmt."complaintId" = c.id
      WHERE c.id = $1
      LIMIT 1`,
      [complaintId],
    );

    return (baseRows as Record<string, unknown>[])[0] ?? null;
  }

  /**
   * Same filtered set as listTickets() but WITHOUT pagination and enriched with
   * the full treatment data (complaint text, AI analysis, compliance, response,
   * decision) for the XLSX export. Capped at 50k rows as a safety bound.
   */
  async exportRows(filters: AnalyticsFilters): Promise<Record<string, unknown>[]> {
    const params: unknown[] = [
      filters.from ?? null,
      filters.to ?? null,
      filters.tipologyKey ?? null,
      filters.decision ?? null,
      filters.rating ?? null,
    ];

    const sql = `
      WITH artifacts_pivot AS (
        SELECT
          a."complaintId",
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'customer_sentiment'))[1] AS sentiment,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'typology_classification'))[1] AS typology_class,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'compliance_evaluation'))[1] AS compliance,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'iqi_template'))[1] AS iqi,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'draft_response'))[1] AS draft_response,
          (ARRAY_AGG(a.content ORDER BY a."createdAt" DESC) FILTER (WHERE a."artifactType" = 'final_response'))[1] AS final_response
        FROM artifact a
        WHERE a."artifactType" IN ('customer_sentiment','typology_classification','compliance_evaluation','iqi_template','draft_response','final_response')
        GROUP BY a."complaintId"
      ),
      latest_review AS (
        SELECT DISTINCT ON ("complaintId")
          "complaintId", "aiResponseRating", status, "reviewedAt", "reviewerUserId", "humanFinalText"
        FROM human_review
        WHERE "reviewedAt" IS NOT NULL
        ORDER BY "complaintId", "reviewedAt" DESC
      ),
      exec_milestones AS (
        SELECT
          te."complaintId" AS complaint_id,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'execution_started') AS started_at,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'paused_human') AS paused_at,
          MIN(tte."occurredAt") FILTER (WHERE tte.milestone = 'decision_made') AS decided_at
        FROM ticket_execution te
        LEFT JOIN ticket_timing_event tte ON tte."executionId" = te.id
        GROUP BY te."complaintId"
      )
      SELECT
        c."protocolNumber" AS protocol_number,
        c."dataDocumento" AS data_documento,
        t.label AS tipology_label,
        t.key AS tipology_key,
        c."riskLevel" AS risk_level,
        c."rawText" AS raw_text,
        c."clienteNome" AS cliente_nome,
        c."cpfCnpjCliente" AS cpf_cnpj_cliente,
        (ap.sentiment ->> 'propensityScore')::float AS propensity_score,
        ap.sentiment ->> 'emotionalTone' AS emotional_tone,
        COALESCE((ap.sentiment ->> 'hasLegalThreat')::boolean, false) AS has_legal_threat,
        COALESCE((ap.sentiment ->> 'hasSocialMediaThreat')::boolean, false) AS has_social_media_threat,
        COALESCE((ap.sentiment ->> 'hasPriorComplaints')::boolean, false) AS has_prior_complaints,
        (ap.typology_class ->> 'confidence')::float AS tipology_confidence,
        ap.iqi ->> 'templateName' AS iqi_template_name,
        (ap.compliance ->> 'complianceScore')::float AS compliance_score,
        (ap.compliance ->> 'isCompliant')::boolean AS is_compliant,
        ap.compliance -> 'violations' AS violations,
        COALESCE(lr."humanFinalText", ap.final_response ->> 'finalResponse', ap.draft_response ->> 'draftResponse') AS response_text,
        lr."aiResponseRating" AS rating,
        lr.status AS decision,
        lr."reviewedAt" AS reviewed_at,
        u.name AS reviewer_name,
        CASE
          WHEN tl."lockedAt" IS NOT NULL AND em.started_at IS NOT NULL
            AND tl."lockedAt" <= em.started_at
          THEN EXTRACT(EPOCH FROM (em.started_at - tl."lockedAt")) * 1000
          ELSE NULL
        END AS first_screen_ms,
        CASE
          WHEN em.paused_at IS NOT NULL AND em.decided_at IS NOT NULL
            AND em.decided_at > em.paused_at
          THEN EXTRACT(EPOCH FROM (em.decided_at - em.paused_at)) * 1000
          ELSE NULL
        END AS second_screen_ms
      FROM complaint c
      LEFT JOIN tipology t ON t.id = c."tipologyId"
      LEFT JOIN artifacts_pivot ap ON ap."complaintId" = c.id
      LEFT JOIN latest_review lr ON lr."complaintId" = c.id
      LEFT JOIN "user" u ON u.id::text = lr."reviewerUserId"
      LEFT JOIN exec_milestones em ON em.complaint_id = c.id
      LEFT JOIN ticket_lock tl ON tl."complaintId" = c.id
      WHERE ($1::date IS NULL OR c."dataDocumento" >= $1::date)
        AND ($2::date IS NULL OR c."dataDocumento" < ($2::date + INTERVAL '1 day'))
        AND ($3::text IS NULL OR t.key = $3)
        AND ($4::text IS NULL OR lr.status = $4)
        AND ($5::int IS NULL OR lr."aiResponseRating" = $5)
      ORDER BY c."dataDocumento" DESC NULLS LAST, c."createdAt" DESC
      LIMIT 50000
    `;
    return this.dataSource.query(sql, params);
  }

  /** List of distinct tipology keys + labels for the filter dropdown. */
  async listTipologyOptions(): Promise<Array<{ key: string; label: string | null }>> {
    return this.dataSource.query(
      `SELECT key, label FROM tipology WHERE "isActive" = true ORDER BY label NULLS LAST`,
    );
  }
}
