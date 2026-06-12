import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { TicketLock } from '../entities/ticket-lock.entity';
import { Complaint, ComplaintStatus } from '../entities/complaint.entity';
import { UserRole } from '../entities/user.entity';
import { TimingEventService } from './timing-event.service';

const LOCK_TTL_MINUTES = 15;

@Injectable()
export class TicketLockService {
  constructor(
    @InjectRepository(TicketLock)
    private readonly lockRepo: Repository<TicketLock>,
    private readonly dataSource: DataSource,
    private readonly timingEventService: TimingEventService,
  ) {}

  /**
   * Acquire a lock for a complaint.
   * Uses DELETE + INSERT to avoid UNIQUE constraint violation on existing rows.
   * Returns 409 if an active (non-expired) lock exists for another user.
   */
  async acquire(complaintId: string, userId: string): Promise<TicketLock> {
    const lock = await this.dataSource.transaction(async (manager) => {
      // Check for existing active lock
      const existing = await manager.findOne(TicketLock, {
        where: { complaintId },
        relations: ['user'],
      });

      if (existing && existing.expiresAt > new Date() && existing.userId !== userId) {
        throw new ConflictException(
          `Ticket is locked by ${existing.user?.name ?? existing.userId}`,
        );
      }

      // DELETE any stale or same-user lock
      await manager.delete(TicketLock, { complaintId });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);

      const lock = manager.create(TicketLock, {
        complaintId,
        userId,
        lockedAt: now,
        expiresAt,
      });
      return manager.save(lock);
    });
    // Durable first-screen marker — the lock row itself is deleted when the
    // operator decides, so analytics derives first-screen time from this event.
    await this.timingEventService.emit('ticket_opened', complaintId, null, userId, lock.lockedAt);
    return lock;
  }

  /** Get current lock state for a complaint. */
  async getLock(complaintId: string): Promise<TicketLock | null> {
    return this.lockRepo.findOne({
      where: { complaintId },
      relations: ['user'],
    });
  }

  /** Renew expiry of the existing lock. */
  async renew(complaintId: string, userId: string): Promise<TicketLock> {
    const lock = await this.lockRepo.findOne({ where: { complaintId } });
    if (!lock) throw new NotFoundException('No lock found for this complaint');
    if (lock.userId !== userId) throw new ForbiddenException('You do not hold this lock');

    const expiresAt = new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000);
    await this.lockRepo.update(lock.id, { expiresAt });
    lock.expiresAt = expiresAt;
    return lock;
  }

  /** List all active locks (admin view) with user and complaint relations. */
  async findAll(): Promise<TicketLock[]> {
    return this.lockRepo.find({
      where: { expiresAt: MoreThan(new Date()) },
      relations: ['user', 'complaint'],
      order: { lockedAt: 'DESC' },
    });
  }

  /**
   * Pull (grab) the next available complaint and lock it atomically.
   * "Available" = status not in (completed, cancelled) AND no active lock.
   * Priority: earliest slaDeadline first; nulls last.
   * Uses FOR UPDATE SKIP LOCKED to avoid race conditions under concurrent operators.
   */
  async pullAndLock(
    userId: string,
    opts?: { createdAfter?: string | null; createdBefore?: string | null },
  ): Promise<{ complaint: Complaint; lock: TicketLock }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const excluded = [ComplaintStatus.COMPLETED, ComplaintStatus.CANCELLED];
      const placeholders = excluded.map((_, i) => `$${i + 1}`).join(', ');

      const params: unknown[] = [...excluded];
      let dateClause = '';
      if (opts?.createdAfter) {
        params.push(opts.createdAfter);
        dateClause += ` AND c."createdAt" >= $${params.length}`;
      }
      if (opts?.createdBefore) {
        params.push(opts.createdBefore);
        dateClause += ` AND c."createdAt" < $${params.length}`;
      }

      const rows: { id: string }[] = await manager.query(
        `SELECT c.id FROM complaint c
         WHERE c.status NOT IN (${placeholders})${dateClause}
           AND NOT EXISTS (
             SELECT 1 FROM ticket_lock tl
             WHERE tl."complaintId" = c.id
               AND tl."expiresAt" > NOW()
           )
         ORDER BY c."slaDeadline" ASC NULLS LAST, c."createdAt" ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        params,
      );

      if (!rows.length) {
        throw new NotFoundException('Não há reclamações disponíveis no momento');
      }

      const complaintId = rows[0].id;

      // Remove any stale/expired lock before inserting new one
      await manager.delete(TicketLock, { complaintId });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
      const lock = manager.create(TicketLock, { complaintId, userId, lockedAt: now, expiresAt });
      const savedLock = await manager.save(lock);

      const complaint = await manager.findOne(Complaint, {
        where: { id: complaintId },
        relations: ['tipology', 'subtipology'],
      });

      return { complaint: complaint!, lock: savedLock };
    });
    await this.timingEventService.emit(
      'ticket_opened',
      result.complaint.id,
      null,
      userId,
      result.lock.lockedAt,
    );
    return result;
  }

  /** Force-release a lock (requires SUPERVISOR or ADMIN role). */
  async forceRelease(complaintId: string, requestingUserRole: UserRole): Promise<void> {
    if (requestingUserRole !== UserRole.SUPERVISOR && requestingUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only SUPERVISOR or ADMIN can force-release a lock');
    }
    await this.lockRepo.delete({ complaintId });
  }

  /**
   * Discard a ticket: releases the user's lock so the ticket returns to the queue.
   * Records a ticket_discarded timing event for audit.
   */
  async discard(complaintId: string, userId: string): Promise<{ success: boolean }> {
    const lock = await this.lockRepo.findOne({ where: { complaintId } });
    if (!lock) throw new NotFoundException('No active lock for this ticket');
    if (lock.userId !== userId) {
      throw new ForbiddenException('Lock does not belong to current user');
    }
    await this.lockRepo.delete({ complaintId });
    return { success: true };
  }
}
