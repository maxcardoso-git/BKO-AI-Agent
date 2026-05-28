import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TurbinaImportPreset } from '../entities/turbina-import-preset.entity';

@Injectable()
export class TurbinaPresetService {
  constructor(
    @InjectRepository(TurbinaImportPreset)
    private readonly repo: Repository<TurbinaImportPreset>,
  ) {}

  async get(userId: string): Promise<Record<string, string[]>> {
    const row = await this.repo.findOne({ where: { userId } });
    return row?.filters ?? {};
  }

  /** Upsert per-user filter preset. Empty object clears it. */
  async save(userId: string, filters: Record<string, string[]>): Promise<void> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) {
      existing.filters = filters;
      await this.repo.save(existing);
    } else {
      await this.repo.save(this.repo.create({ userId, filters }));
    }
  }
}
