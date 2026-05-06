/**
 * Timing metrics computed from ticket_timing_event rows. (AUDIT-TIMING-02)
 * All values are in milliseconds; null when the relevant events are not yet present.
 *
 * NOTE on tempo_nota_a_processamento:
 *   This metric depends on `note_saved` events, which are emitted by Phase 9
 *   ComplaintUserNoteService.create(). After Phase 8 alone (this plan), it will
 *   ALWAYS be null because no `note_saved` events are written yet. Smoke tests
 *   in this plan assert null; Phase 9 verification asserts non-null.
 */
export class TimingMetricsDto {
  /** First→last event span (ticket_created → completed if available; else last event). */
  tempo_total: number | null;

  /** ticket_created → completed (or null if not completed). */
  tempo_sla: number | null;

  /** Sum of all (paused_human → decision_made) intervals. */
  tempo_revisao_humana: number | null;

  /** note_saved (most recent) → execution_started.
   *  Always null after Phase 8; populated by Phase 9 (ComplaintUserNoteService emits note_saved). */
  tempo_nota_a_processamento: number | null;

  /** approved → completed. */
  tempo_aprovacao_a_conclusao: number | null;

  /** Raw events grouped by milestone, for debugging / Phase 10 audit page. */
  events: Array<{ milestone: string; occurredAt: string; userId: string | null }>;
}
