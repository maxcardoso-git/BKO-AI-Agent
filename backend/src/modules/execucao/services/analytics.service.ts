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

    const whereSql = `
      WHERE ($1::timestamp IS NULL OR c."createdAt" >= $1::timestamp)
        AND ($2::timestamp IS NULL OR c."createdAt" <= $2::timestamp)
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
      )
    `;

    const rowsSql = `
      ${baseCte}
      SELECT
        c.id AS complaint_id,
        c."protocolNumber" AS protocol_number,
        c."createdAt" AS created_at,
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
      ORDER BY c."createdAt" DESC
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

  /** List of distinct tipology keys + labels for the filter dropdown. */
  async listTipologyOptions(): Promise<Array<{ key: string; label: string | null }>> {
    return this.dataSource.query(
      `SELECT key, label FROM tipology WHERE "isActive" = true ORDER BY label NULLS LAST`,
    );
  }
}
