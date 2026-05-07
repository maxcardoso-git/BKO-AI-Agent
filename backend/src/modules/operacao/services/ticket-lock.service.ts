import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { TicketLock } from '../entities/ticket-lock.entity';
import { UserRole } from '../entities/user.entity';

const LOCK_TTL_MINUTES = 15;

@Injectable()
export class TicketLockService {
  constructor(
    @InjectRepository(TicketLock)
    private readonly lockRepo: Repository<TicketLock>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Acquire a lock for a complaint.
   * Uses DELETE + INSERT to avoid UNIQUE constraint violation on existing rows.
   * Returns 409 if an active (non-expired) lock exists for another user.
   */
  async acquire(complaintId: string, userId: string): Promise<TicketLock> {
    return this.dataSource.transaction(async (manager) => {
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

  /** Force-release a lock (requires SUPERVISOR or ADMIN role). */
  async forceRelease(complaintId: string, requestingUserRole: UserRole): Promise<void> {
    if (requestingUserRole !== UserRole.SUPERVISOR && requestingUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only SUPERVISOR or ADMIN can force-release a lock');
    }
    await this.lockRepo.delete({ complaintId });
  }
}
