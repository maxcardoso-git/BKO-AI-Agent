import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTimingEvent } from '../entities/ticket-timing-event.entity';

export type TimingMilestone =
  | 'ticket_created'
  | 'note_saved'
  | 'execution_started'
  | 'paused_human'
  | 'decision_made'
  | 'approved'
  | 'completed'
  | 'ticket_discarded';

@Injectable()
export class TimingEventService {
  constructor(
    @InjectRepository(TicketTimingEvent)
    private readonly ticketTimingEventRepo: Repository<TicketTimingEvent>,
  ) {}

  /**
   * Emit a single ticket_timing_event row.
   * userId is null for automatic events (execution_started, paused_human, ticket_created).
   * userId is non-null for human-driven events (note_saved, decision_made, approved, completed) — emitted by Phase 9/10 services.
   */
  async emit(
    milestone: TimingMilestone,
    complaintId: string,
    executionId: string | null = null,
    userId: string | null = null,
    occurredAt: Date = new Date(),
  ): Promise<TicketTimingEvent> {
    return this.ticketTimingEventRepo.save(
      this.ticketTimingEventRepo.create({
        complaintId,
        executionId,
        milestone,
        occurredAt,
        userId,
      }),
    );
  }

  /**
   * Idempotent variant — only inserts if no event with the same (complaintId, milestone) exists.
   * Used by ticket_created which must be unique per complaint.
   */
  async emitOnce(
    milestone: TimingMilestone,
    complaintId: string,
    executionId: string | null = null,
    userId: string | null = null,
    occurredAt: Date = new Date(),
  ): Promise<void> {
    const existing = await this.ticketTimingEventRepo.findOne({
      where: { complaintId, milestone },
    });
    if (!existing) {
      await this.emit(milestone, complaintId, executionId, userId, occurredAt);
    }
  }
}
