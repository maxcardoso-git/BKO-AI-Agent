import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ResetStats {
  complaints: number;
  executions: number;
  stepExecutions: number;
  artifacts: number;
  reviews: number;
  notes: number;
  timingEvents: number;
  locks: number;
  llmCalls: number;
  feedbackMemory: number;
  caseMemory: number;
  auditLog: number;
}

@Injectable()
export class DatabaseResetService {
  private readonly logger = new Logger(DatabaseResetService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Counts what would be wiped — feeds the confirmation UI. */
  async getStats(): Promise<ResetStats> {
    const [row] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::int FROM complaint)              AS complaints,
        (SELECT COUNT(*)::int FROM ticket_execution)       AS executions,
        (SELECT COUNT(*)::int FROM step_execution)         AS step_executions,
        (SELECT COUNT(*)::int FROM artifact)               AS artifacts,
        (SELECT COUNT(*)::int FROM human_review)           AS reviews,
        (SELECT COUNT(*)::int FROM complaint_user_note)    AS notes,
        (SELECT COUNT(*)::int FROM ticket_timing_event)    AS timing_events,
        (SELECT COUNT(*)::int FROM ticket_lock)            AS locks,
        (SELECT COUNT(*)::int FROM llm_call)               AS llm_calls,
        (SELECT COUNT(*)::int FROM human_feedback_memory)  AS feedback_memory,
        (SELECT COUNT(*)::int FROM case_memory)            AS case_memory,
        (SELECT COUNT(*)::int FROM audit_log)              AS audit_log
    `);
    return {
      complaints: Number(row.complaints ?? 0),
      executions: Number(row.executions ?? 0),
      stepExecutions: Number(row.step_executions ?? 0),
      artifacts: Number(row.artifacts ?? 0),
      reviews: Number(row.reviews ?? 0),
      notes: Number(row.notes ?? 0),
      timingEvents: Number(row.timing_events ?? 0),
      locks: Number(row.locks ?? 0),
      llmCalls: Number(row.llm_calls ?? 0),
      feedbackMemory: Number(row.feedback_memory ?? 0),
      caseMemory: Number(row.case_memory ?? 0),
      auditLog: Number(row.audit_log ?? 0),
    };
  }

  /**
   * Destructive operation. Wipes all ticket-related data plus AI memory and
   * audit log. Master / config tables (user, tipology, situation, templates,
   * step definitions, kb_*, llm_model_config, persona, regulatory_*) are
   * preserved, as is turbina_import_preset (per-user filter UI state).
   *
   * Uses TRUNCATE ... CASCADE inside a transaction. CASCADE chains complaint
   * to its dependent tables (complaint_*, ticket_*, step_execution, artifact,
   * human_review, llm_call, token_usage).
   *
   * Caller MUST pass confirm === "APAGAR" — controller forwards from request
   * body so the check stays close to the destruction.
   */
  async wipe(confirm: string, userId: string): Promise<ResetStats> {
    if (confirm !== 'APAGAR') {
      throw new BadRequestException('Confirmação obrigatória: envie { confirm: "APAGAR" }');
    }

    const before = await this.getStats();
    this.logger.warn(
      `[RESET] User ${userId} triggered database wipe. Pre-wipe counts: ${JSON.stringify(before)}`,
    );

    await this.dataSource.transaction(async (manager) => {
      // Order matters less with CASCADE, but explicit list documents the scope.
      // RESTART IDENTITY zeroes any serial sequences (none here, all UUID, but harmless).
      await manager.query(`TRUNCATE TABLE
        complaint,
        human_feedback_memory,
        case_memory,
        audit_log
      RESTART IDENTITY CASCADE`);
    });

    const after = await this.getStats();
    this.logger.warn(`[RESET] User ${userId} wipe complete. Post-wipe counts: ${JSON.stringify(after)}`);

    return before;
  }
}
