import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ComplaintUserNote } from '../entities/complaint-user-note.entity';
import { TimingEventService } from './timing-event.service';

@Injectable()
export class ComplaintUserNoteService {
  constructor(
    @InjectRepository(ComplaintUserNote)
    private readonly noteRepo: Repository<ComplaintUserNote>,
    private readonly dataSource: DataSource,
    private readonly timingEventService: TimingEventService,
  ) {}

  /**
   * List all notes for a complaint, ordered by version DESC.
   */
  async findAll(complaintId: string): Promise<ComplaintUserNote[]> {
    return this.noteRepo.find({
      where: { complaintId },
      order: { version: 'DESC' },
      relations: ['user'],
    });
  }

  /**
   * Create a new note version (transactional):
   * 1. Deactivate old active note(s)
   * 2. Insert new version with version = max(existing) + 1
   * 3. Emit note_saved timing event
   */
  async create(
    complaintId: string,
    userId: string,
    content: string,
    parameters?: Record<string, unknown> | null,
  ): Promise<ComplaintUserNote> {
    const note = await this.dataSource.transaction(async (manager) => {
      // Deactivate existing active notes
      await manager
        .createQueryBuilder()
        .update(ComplaintUserNote)
        .set({ isActive: false })
        .where('complaintId = :complaintId AND isActive = true', { complaintId })
        .execute();

      // Determine next version
      const maxRow = await manager
        .createQueryBuilder(ComplaintUserNote, 'note')
        .select('MAX(note.version)', 'max')
        .where('note.complaintId = :complaintId', { complaintId })
        .getRawOne<{ max: string | null }>();

      const nextVersion = maxRow?.max ? parseInt(maxRow.max, 10) + 1 : 1;

      const entity = manager.create(ComplaintUserNote, {
        complaintId,
        userId,
        content,
        parameters: parameters ?? null,
        version: nextVersion,
        isActive: true,
      });
      return manager.save(entity);
    });

    // Emit timing event outside transaction (non-fatal)
    try {
      await this.timingEventService.emit('note_saved', complaintId, null, userId);
    } catch (_) {
      // non-fatal — timing event failure should not block note persistence
    }

    return note;
  }
}
