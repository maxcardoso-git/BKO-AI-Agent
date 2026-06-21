import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ObservabilityService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ─── Rule 1 corrections applied ───────────────────────────────────────────
  // - step_execution column is "stepKey" not "skillKey"
  // - token_usage has no stepExecutionId or estimatedCostUsd; cost is in llm_call.costUsd
  //   and token_usage joins via llm_call.tokenUsageId
  // - audit_log has no ticketExecutionId; uses entityType/entityId pattern

  async getLatencyByStep(): Promise<
    Array<{
      step_key: string;
      avg_latency_ms: string;
      total_executions: string;
      error_count: string;
    }>
  > {
    return this.dataSource.query(`
      SELECT "stepKey" AS step_key,
             ROUND(AVG("durationMs")) AS avg_latency_ms,
             COUNT(*) AS total_executions,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS error_count
      FROM step_execution
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
      GROUP BY "stepKey"
      ORDER BY avg_latency_ms DESC
    `);
  }

  async getCostByTicket(): Promise<
    Array<{
      complaintId: string;
      total_cost_usd: string;
      total_tokens: string;
    }>
  > {
    // token_usage links to llm_call via llm_call.tokenUsageId (OneToOne)
    // cost column is costUsd on both llm_call and token_usage; use llm_call.costUsd
    return this.dataSource.query(`
      SELECT te."complaintId",
             ROUND(COALESCE(SUM(lc."costUsd"), 0)::numeric, 6) AS total_cost_usd,
             COALESCE(SUM(lc."totalTokens"), 0) AS total_tokens
      FROM ticket_execution te
      INNER JOIN step_execution se ON se."ticketExecutionId" = te.id
      INNER JOIN llm_call lc ON lc."stepExecutionId" = se.id
      GROUP BY te."complaintId"
      ORDER BY total_cost_usd DESC
      LIMIT 50
    `);
  }

  async getErrorRateBySkill(): Promise<
    Array<{
      step_key: string;
      total: string;
      errors: string;
      error_rate_pct: string;
    }>
  > {
    return this.dataSource.query(`
      SELECT "stepKey" AS step_key,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS errors,
             ROUND(100.0 * SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS error_rate_pct
      FROM step_execution
      GROUP BY "stepKey"
      ORDER BY error_rate_pct DESC
    `);
  }

  async getHitlRate(): Promise<{
    hitl_count: string;
    total_count: string;
    hitl_rate_pct: string;
  }> {
    const rows = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'waiting_human') AS hitl_count,
        COUNT(*) AS total_count,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'waiting_human') / NULLIF(COUNT(*),0), 2) AS hitl_rate_pct
      FROM step_execution
    `);
    return rows[0] ?? { hitl_count: '0', total_count: '0', hitl_rate_pct: '0.00' };
  }

  async getConformanceByTipologia(): Promise<
    Array<{
      tipology_key: string;
      tipology_name: string;
      avg_compliance_score: string;
      evaluated_count: string;
    }>
  > {
    return this.dataSource.query(`
      SELECT t.key AS tipology_key,
             t.label AS tipology_name,
             ROUND(AVG((a.content->>'complianceScore')::float)::numeric, 2) AS avg_compliance_score,
             COUNT(a.id) AS evaluated_count
      FROM artifact a
      INNER JOIN step_execution se ON a."stepExecutionId" = se.id
      INNER JOIN ticket_execution te ON se."ticketExecutionId" = te.id
      INNER JOIN complaint c ON te."complaintId" = c.id
      INNER JOIN tipology t ON c."tipologyId" = t.id
      WHERE a."artifactType" = 'compliance_evaluation'
        AND (a.content->>'complianceScore') IS NOT NULL
      GROUP BY t.key, t.label
      ORDER BY avg_compliance_score DESC
    `);
  }

  async getTokenTotals(): Promise<{
    total_tokens: string;
    prompt_tokens: string;
    completion_tokens: string;
    total_cost_usd: string;
    total_calls: string;
  }> {
    // Aggregate from llm_call (which holds costUsd + token counts)
    const rows = await this.dataSource.query(`
      SELECT
        COALESCE(SUM("totalTokens"), 0) AS total_tokens,
        COALESCE(SUM("promptTokens"), 0) AS prompt_tokens,
        COALESCE(SUM("completionTokens"), 0) AS completion_tokens,
        ROUND(COALESCE(SUM("costUsd"), 0)::numeric, 4) AS total_cost_usd,
        COUNT(*) AS total_calls
      FROM llm_call
    `);
    return (
      rows[0] ?? {
        total_tokens: '0',
        prompt_tokens: '0',
        completion_tokens: '0',
        total_cost_usd: '0.0000',
        total_calls: '0',
      }
    );
  }

  async getExecutionTrace(execId: string): Promise<
    Array<{
      id: string;
      stepKey: string;
      status: string;
      startedAt: Date | null;
      completedAt: Date | null;
      durationMs: number | null;
      errorMessage: string | null;
      retryCount: number;
      llm_calls: Array<{
        id: string;
        model: string;
        provider: string;
        latencyMs: number | null;
        responseStatus: string;
      }>;
      artifacts: Array<{
        id: string;
        artifactType: string;
        createdAt: Date;
      }>;
    }>
  > {
    return this.dataSource.query(
      `
      SELECT
        se.id, se."stepKey", se.status,
        se."startedAt", se."completedAt", se."durationMs",
        se."errorMessage", se."retryCount",
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', lc.id, 'model', lc."model", 'provider', lc.provider,
          'latencyMs', lc."latencyMs", 'responseStatus', lc."responseStatus"
        )) FILTER (WHERE lc.id IS NOT NULL), '[]') AS llm_calls,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'id', a.id, 'artifactType', a."artifactType", 'createdAt', a."createdAt"
        )) FILTER (WHERE a.id IS NOT NULL), '[]') AS artifacts
      FROM step_execution se
      LEFT JOIN llm_call lc ON lc."stepExecutionId" = se.id
      LEFT JOIN artifact a ON a."stepExecutionId" = se.id
      WHERE se."ticketExecutionId" = $1
      GROUP BY se.id
      ORDER BY se."createdAt" ASC
    `,
      [execId],
    );
  }

  // ─── TMT — Tempo Médio de Tratamento ──────────────────────────────────────
  // Start: ticket_timing_event milestone='execution_started' (when operator clicks "Iniciar Processamento")
  // End:   ticket_timing_event milestone='approved' OR human_review.reviewedAt with status='approved'
  //        (fallback covers historical executions before milestone 'approved' was emitted)

  private buildTmtCte(
    from: Date,
    to: Date,
    filters: { decision: string | null; rating: number | null; tipologyKey: string | null },
  ): { sql: string; params: unknown[] } {
    // CTE that resolves start/end per execution and joins complaint metadata +
    // the execution's latest human review (decision/rating/operator). The
    // review drives the gate so the dashboard can be filtered by decision,
    // exactly like /admin/analises (default 'approved').
    const sql = `
      WITH tmt_base AS (
        SELECT
          te.id AS execution_id,
          te."complaintId" AS complaint_id,
          c."tipologyId" AS tipology_id,
          c."riskLevel" AS risk_level,
          (SELECT key FROM tipology WHERE id = c."tipologyId") AS tipology_key,
          (
            SELECT MIN(tte."occurredAt") FROM ticket_timing_event tte
            WHERE tte."executionId" = te.id AND tte.milestone = 'execution_started'
          ) AS started_at,
          -- Latest human review of this execution drives decision / rating / operator.
          (SELECT hr.status FROM human_review hr
             INNER JOIN step_execution se ON se.id = hr."stepExecutionId"
             WHERE se."ticketExecutionId" = te.id AND hr."reviewedAt" IS NOT NULL
             ORDER BY hr."reviewedAt" DESC LIMIT 1) AS decision,
          (SELECT hr."aiResponseRating" FROM human_review hr
             INNER JOIN step_execution se ON se.id = hr."stepExecutionId"
             WHERE se."ticketExecutionId" = te.id AND hr."reviewedAt" IS NOT NULL
             ORDER BY hr."reviewedAt" DESC LIMIT 1) AS rating,
          (SELECT hr."reviewerUserId" FROM human_review hr
             INNER JOIN step_execution se ON se.id = hr."stepExecutionId"
             WHERE se."ticketExecutionId" = te.id AND hr."reviewedAt" IS NOT NULL
             ORDER BY hr."reviewedAt" DESC LIMIT 1) AS operator_user_id,
          (
            SELECT MIN(tte4."occurredAt") FROM ticket_timing_event tte4
            WHERE tte4."executionId" = te.id AND tte4.milestone = 'paused_human'
          ) AS paused_at,
          (
            SELECT MIN(tte5."occurredAt") FROM ticket_timing_event tte5
            WHERE tte5."executionId" = te.id AND tte5.milestone = 'decision_made'
          ) AS decided_at
        FROM ticket_execution te
        INNER JOIN complaint c ON c.id = te."complaintId"
      ),
      tmt AS (
        -- TMT = 1st screen (ticket_opened→execution_started) + 2nd screen
        -- (paused_human→decision_made). Operator-only handling time: the AI
        -- pipeline and finalization are intentionally excluded. Rows without a
        -- measurable sum (NULL on either screen) are dropped so COUNT(*)/AVG
        -- stay consistent across the dashboard.
        -- Gate: execution must be DECIDED, and matches the decision/rating/
        -- tipology filters. $3 (decision) defaults to 'approved' from the
        -- service — so by default only approved executions count (no double
        -- count of rejected-then-reprocessed tickets).
        SELECT
          execution_id,
          complaint_id,
          tipology_id,
          risk_level,
          operator_user_id,
          started_at,
          first_screen_ms,
          second_screen_ms,
          (first_screen_ms + second_screen_ms) AS tmt_ms
        FROM (
          SELECT
            tb.execution_id,
            tb.complaint_id,
            tb.tipology_id,
            tb.risk_level,
            tb.operator_user_id,
            tb.started_at,
            EXTRACT(EPOCH FROM (tb.started_at - (
              SELECT MAX(o."occurredAt") FROM ticket_timing_event o
              WHERE o."complaintId" = tb.complaint_id
                AND o.milestone = 'ticket_opened'
                AND o."occurredAt" <= tb.started_at
            ))) * 1000 AS first_screen_ms,
            CASE
              WHEN tb.paused_at IS NOT NULL AND tb.decided_at IS NOT NULL
                AND tb.decided_at > tb.paused_at
              THEN EXTRACT(EPOCH FROM (tb.decided_at - tb.paused_at)) * 1000
              ELSE NULL
            END AS second_screen_ms
          FROM tmt_base tb
          WHERE tb.started_at IS NOT NULL
            AND tb.decision IS NOT NULL
            AND ($3::text IS NULL OR tb.decision = $3)
            AND ($4::int IS NULL OR tb.rating = $4)
            AND ($5::text IS NULL OR tb.tipology_key = $5)
            AND tb.started_at >= $1
            AND tb.started_at < $2
        ) s
        WHERE first_screen_ms IS NOT NULL
          AND second_screen_ms IS NOT NULL
      )
    `;
    return { sql, params: [from, to, filters.decision, filters.rating, filters.tipologyKey] };
  }

  async getTmt(
    fromISO?: string,
    toISO?: string,
    filters?: { decision?: string | null; rating?: number | null; tipologyKey?: string | null },
  ): Promise<{
    range: { from: string; to: string };
    summary: {
      count: number;
      avgMs: number;
      medianMs: number;
      p95Ms: number;
      minMs: number;
      maxMs: number;
      avgFirstMs: number;
      avgSecondMs: number;
    };
    byTipology: Array<{ tipologyKey: string | null; tipologyLabel: string | null; avgMs: number; avgFirstMs: number; avgSecondMs: number; count: number }>;
    byOperator: Array<{ userId: string | null; name: string | null; email: string | null; avgMs: number; avgFirstMs: number; avgSecondMs: number; count: number }>;
    byTipologyOperator: Array<{ tipologyKey: string | null; tipologyLabel: string | null; userId: string | null; name: string | null; count: number }>;
    byRisk: Array<{ risk: string | null; avgMs: number; count: number }>;
    series: Array<{ date: string; avgMs: number; firstAvgMs: number; secondAvgMs: number; count: number }>;
    points: Array<{
      startedAt: string;
      tmtMs: number;
      firstMs: number;
      secondMs: number;
      risk: string | null;
      tipologyKey: string | null;
      tipologyLabel: string | null;
      operatorUserId: string | null;
      operatorName: string | null;
    }>;
  }> {
    const to = toISO ? new Date(toISO) : new Date();
    const from = fromISO ? new Date(fromISO) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Decision defaults to 'approved' (matches /admin/analises and keeps the
    // approved-only scope) unless explicitly set to null = "Todas".
    const decision = filters?.decision === undefined ? 'approved' : filters.decision;
    const { sql: cte, params } = this.buildTmtCte(from, to, {
      decision: decision ?? null,
      rating: filters?.rating ?? null,
      tipologyKey: filters?.tipologyKey ?? null,
    });

    const [summaryRows, byTipologyRows, byOperatorRows, byRiskRows, seriesRows, pointsRows, byTipoOpRows] = await Promise.all([
      this.dataSource.query(
        `${cte}
         SELECT
           COUNT(*)::int AS count,
           COALESCE(AVG(tmt_ms), 0)::float AS avg_ms,
           COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tmt_ms), 0)::float AS median_ms,
           COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY tmt_ms), 0)::float AS p95_ms,
           COALESCE(MIN(tmt_ms), 0)::float AS min_ms,
           COALESCE(MAX(tmt_ms), 0)::float AS max_ms,
           COALESCE(AVG(first_screen_ms), 0)::float AS avg_first_ms,
           COALESCE(AVG(second_screen_ms), 0)::float AS avg_second_ms
         FROM tmt`,
        params,
      ),
      this.dataSource.query(
        `${cte}
         SELECT
           t.key AS tipology_key,
           t.label AS tipology_label,
           COALESCE(AVG(tmt.tmt_ms), 0)::float AS avg_ms,
           COALESCE(AVG(tmt.first_screen_ms), 0)::float AS avg_first_ms,
           COALESCE(AVG(tmt.second_screen_ms), 0)::float AS avg_second_ms,
           COUNT(*)::int AS count
         FROM tmt
         LEFT JOIN tipology t ON t.id = tmt.tipology_id
         GROUP BY t.key, t.label
         ORDER BY avg_ms DESC`,
        params,
      ),
      this.dataSource.query(
        `${cte}
         SELECT
           tmt.operator_user_id AS user_id,
           u.name AS name,
           u.email AS email,
           COALESCE(AVG(tmt.tmt_ms), 0)::float AS avg_ms,
           COALESCE(AVG(tmt.first_screen_ms), 0)::float AS avg_first_ms,
           COALESCE(AVG(tmt.second_screen_ms), 0)::float AS avg_second_ms,
           COUNT(*)::int AS count
         FROM tmt
         LEFT JOIN "user" u ON u.id::text = tmt.operator_user_id
         GROUP BY tmt.operator_user_id, u.name, u.email
         ORDER BY avg_ms DESC`,
        params,
      ),
      this.dataSource.query(
        `${cte}
         SELECT
           tmt.risk_level AS risk,
           COALESCE(AVG(tmt.tmt_ms), 0)::float AS avg_ms,
           COUNT(*)::int AS count
         FROM tmt
         GROUP BY tmt.risk_level
         ORDER BY avg_ms DESC`,
        params,
      ),
      this.dataSource.query(
        `${cte}
         SELECT
           to_char(date_trunc('day', tmt.started_at), 'YYYY-MM-DD') AS date,
           COALESCE(AVG(tmt.tmt_ms), 0)::float AS avg_ms,
           COALESCE(AVG(tmt.first_screen_ms), 0)::float AS avg_first_ms,
           COALESCE(AVG(tmt.second_screen_ms), 0)::float AS avg_second_ms,
           COUNT(*)::int AS count
         FROM tmt
         GROUP BY date_trunc('day', tmt.started_at)
         ORDER BY date_trunc('day', tmt.started_at) ASC`,
        params,
      ),
      // Per-ticket points for the scatter charts (by tipology / by operator).
      // Capped at 5000 to keep the payload and chart render sane.
      this.dataSource.query(
        `${cte}
         SELECT
           tmt.started_at AS started_at,
           tmt.tmt_ms AS tmt_ms,
           tmt.first_screen_ms AS first_ms,
           tmt.second_screen_ms AS second_ms,
           tmt.risk_level AS risk,
           t.key AS tipology_key,
           t.label AS tipology_label,
           tmt.operator_user_id AS operator_user_id,
           u.name AS operator_name
         FROM tmt
         LEFT JOIN tipology t ON t.id = tmt.tipology_id
         LEFT JOIN "user" u ON u.id::text = tmt.operator_user_id
         ORDER BY tmt.started_at ASC
         LIMIT 5000`,
        params,
      ),
      // Ticket counts per tipology × operator — feeds the stacked-bar chart.
      this.dataSource.query(
        `${cte}
         SELECT
           t.key AS tipology_key,
           t.label AS tipology_label,
           tmt.operator_user_id AS user_id,
           u.name AS name,
           COUNT(*)::int AS count
         FROM tmt
         LEFT JOIN tipology t ON t.id = tmt.tipology_id
         LEFT JOIN "user" u ON u.id::text = tmt.operator_user_id
         GROUP BY t.key, t.label, tmt.operator_user_id, u.name
         ORDER BY count DESC`,
        params,
      ),
    ]);

    const summary = summaryRows[0] ?? { count: 0, avg_ms: 0, median_ms: 0, p95_ms: 0, min_ms: 0, max_ms: 0, avg_first_ms: 0, avg_second_ms: 0 };

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        count: Number(summary.count) || 0,
        avgMs: Number(summary.avg_ms) || 0,
        medianMs: Number(summary.median_ms) || 0,
        p95Ms: Number(summary.p95_ms) || 0,
        minMs: Number(summary.min_ms) || 0,
        maxMs: Number(summary.max_ms) || 0,
        avgFirstMs: Number(summary.avg_first_ms) || 0,
        avgSecondMs: Number(summary.avg_second_ms) || 0,
      },
      byTipology: byTipologyRows.map((r: { tipology_key: string | null; tipology_label: string | null; avg_ms: number; avg_first_ms: number; avg_second_ms: number; count: number }) => ({
        tipologyKey: r.tipology_key,
        tipologyLabel: r.tipology_label,
        avgMs: Number(r.avg_ms) || 0,
        avgFirstMs: Number(r.avg_first_ms) || 0,
        avgSecondMs: Number(r.avg_second_ms) || 0,
        count: Number(r.count) || 0,
      })),
      byOperator: byOperatorRows.map((r: { user_id: string | null; name: string | null; email: string | null; avg_ms: number; avg_first_ms: number; avg_second_ms: number; count: number }) => ({
        userId: r.user_id,
        name: r.name,
        email: r.email,
        avgMs: Number(r.avg_ms) || 0,
        avgFirstMs: Number(r.avg_first_ms) || 0,
        avgSecondMs: Number(r.avg_second_ms) || 0,
        count: Number(r.count) || 0,
      })),
      byTipologyOperator: byTipoOpRows.map((r: { tipology_key: string | null; tipology_label: string | null; user_id: string | null; name: string | null; count: number }) => ({
        tipologyKey: r.tipology_key,
        tipologyLabel: r.tipology_label,
        userId: r.user_id,
        name: r.name,
        count: Number(r.count) || 0,
      })),
      byRisk: byRiskRows.map((r: { risk: string | null; avg_ms: number; count: number }) => ({
        risk: r.risk,
        avgMs: Number(r.avg_ms) || 0,
        count: Number(r.count) || 0,
      })),
      series: seriesRows.map((r: { date: string; avg_ms: number; avg_first_ms: number; avg_second_ms: number; count: number }) => ({
        date: r.date,
        avgMs: Number(r.avg_ms) || 0,
        firstAvgMs: Number(r.avg_first_ms) || 0,
        secondAvgMs: Number(r.avg_second_ms) || 0,
        count: Number(r.count) || 0,
      })),
      points: pointsRows.map((r: { started_at: string | Date; tmt_ms: number; first_ms: number; second_ms: number; risk: string | null; tipology_key: string | null; tipology_label: string | null; operator_user_id: string | null; operator_name: string | null }) => ({
        startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
        tmtMs: Number(r.tmt_ms) || 0,
        firstMs: Number(r.first_ms) || 0,
        secondMs: Number(r.second_ms) || 0,
        risk: r.risk,
        tipologyKey: r.tipology_key,
        tipologyLabel: r.tipology_label,
        operatorUserId: r.operator_user_id,
        operatorName: r.operator_name,
      })),
    };
  }

  /**
   * Returns global average time (in minutes) between paused_human and decision_made events.
   * Used by GET /api/admin/observability/human-review-avg-time.
   * Joins on executionId to correlate the two events for the same ticket execution.
   */
  async getHumanReviewAvgTime(): Promise<{ avgMinutes: number | null; sampleSize: number }> {
    const rows = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (dm."occurredAt" - ph."occurredAt"))/60) AS avg_min,
              COUNT(*) AS sample
       FROM ticket_timing_event ph
       JOIN ticket_timing_event dm
         ON dm."executionId" = ph."executionId"
        AND dm.milestone = 'decision_made'
       WHERE ph.milestone = 'paused_human'
         AND dm."occurredAt" > ph."occurredAt"`,
    );
    const row = rows[0];
    return {
      avgMinutes:
        row?.avg_min !== null && row?.avg_min !== undefined ? Number(row.avg_min) : null,
      sampleSize: Number(row?.sample ?? 0),
    };
  }

  /**
   * Aggregates operator ratings (1-3 stars) of AI-generated drafts.
   * Returns global average + count + per-star distribution. Used by the
   * dashboard's "Qualidade da Resposta IA" section.
   */
  async getAiResponseRatingStats(): Promise<{
    avg: number | null;
    count: number;
    distribution: Array<{ stars: number; count: number }>;
  }> {
    const rows = await this.dataSource.query(
      `SELECT "aiResponseRating" AS stars, COUNT(*)::int AS count
       FROM human_review
       WHERE "aiResponseRating" IS NOT NULL
       GROUP BY "aiResponseRating"
       ORDER BY "aiResponseRating" ASC`,
    );
    const distribution: Array<{ stars: number; count: number }> = [1, 2, 3].map((s) => {
      const row = rows.find((r: { stars: number }) => Number(r.stars) === s);
      return { stars: s, count: row ? Number(row.count) : 0 };
    });
    const totalCount = distribution.reduce((acc, d) => acc + d.count, 0);
    const totalStars = distribution.reduce((acc, d) => acc + d.stars * d.count, 0);
    return {
      avg: totalCount > 0 ? totalStars / totalCount : null,
      count: totalCount,
      distribution,
    };
  }

  async getTicketLogs(complaintId: string): Promise<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      userId: string | null;
      details: Record<string, unknown> | null;
      createdAt: Date;
    }>
  > {
    // audit_log uses entityType/entityId pattern (no ticketExecutionId FK)
    // Retrieve logs where entityType='complaint' AND entityId=complaintId
    // UNION logs where entityType='ticket_execution' AND entityId IN (SELECT id FROM ticket_execution WHERE complaintId=...)
    return this.dataSource.query(
      `
      SELECT al.id, al.action, al."entityType", al."entityId", al."userId", al.details, al."createdAt"
      FROM audit_log al
      WHERE (al."entityType" = 'complaint' AND al."entityId" = $1)
         OR (al."entityType" = 'ticket_execution' AND al."entityId" IN (
               SELECT te.id FROM ticket_execution te WHERE te."complaintId" = $1
             ))
      ORDER BY al."createdAt" ASC
    `,
      [complaintId],
    );
  }
}
