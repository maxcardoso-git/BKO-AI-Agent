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
