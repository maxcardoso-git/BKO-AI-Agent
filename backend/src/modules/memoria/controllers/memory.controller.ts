import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseMemory } from '../entities/case-memory.entity';
import { HumanFeedbackMemory } from '../entities/human-feedback-memory.entity';
import { StyleMemory } from '../entities/style-memory.entity';

@Controller('memory')
export class MemoryController {
  constructor(
    @InjectRepository(CaseMemory)
    private readonly caseRepo: Repository<CaseMemory>,
    @InjectRepository(HumanFeedbackMemory)
    private readonly feedbackRepo: Repository<HumanFeedbackMemory>,
    @InjectRepository(StyleMemory)
    private readonly styleRepo: Repository<StyleMemory>,
  ) {}

  @Get('cases')
  async getCases(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('includeInactive') includeInactive?: string,
  ) {
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const where = includeInactive === 'true' ? {} : { isActive: true };
    const items = await this.caseRepo.find({
      where,
      relations: ['complaint', 'tipology'],
      skip,
      take,
      order: { createdAt: 'DESC' },
    });

    // Shape mapping kept in sync with frontend `CaseMemory` type in
    // BKOConsole/src/types/memory.ts. Without this map the UI shows "—"
    // because the raw entity uses different field names (summary vs summaryText).
    return items.map((c) => ({
      id: c.id,
      complaintId: c.complaintId,
      tipologiaId: c.tipologyId,
      tipologiaName: c.tipology?.label ?? null,
      summaryText: c.summary,
      approvedResponseText: c.responseSnippet,
      outcome: c.outcome,
      decision: c.decision,
      protocolNumber: c.complaint?.protocolNumber ?? null,
      modalidade: c.complaint?.modalidade ?? null,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));
  }

  @Patch('cases/:id/deactivate')
  async deactivateCase(@Param('id', ParseUUIDPipe) id: string) {
    await this.caseRepo.update(id, { isActive: false } as any);
    return { success: true };
  }

  @Patch('cases/:id/activate')
  async activateCase(@Param('id', ParseUUIDPipe) id: string) {
    await this.caseRepo.update(id, { isActive: true } as any);
    return { success: true };
  }

  @Get('feedback')
  async getFeedback(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(parseInt(limit, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const items = await this.feedbackRepo.find({
      relations: ['complaint', 'tipology'],
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
    return items.map((f) => ({
      id: f.id,
      humanReviewId: f.complaintId,
      protocolNumber: f.complaint?.protocolNumber ?? null,
      correctionSummary: f.diffDescription,
      tipologiaId: f.tipologyId,
      tipologiaName: f.tipology?.label ?? null,
      correctionCategory: f.correctionCategory,
      correctionWeight: f.correctionWeight,
      aiText: f.aiText,
      humanText: f.humanText,
      createdAt: f.createdAt,
    }));
  }

  @Get('style')
  async getStyle(@Query('tipologiaId') tipologiaId?: string) {
    const where = tipologiaId ? { tipologyId: tipologiaId } : {};
    const items = await this.styleRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return items.map((s) => ({
      id: s.id,
      tipologiaId: s.tipologyId,
      expressionType: s.expressionType,
      expressionText: s.expressionText,
      isActive: s.isActive,
      createdAt: s.createdAt,
    }));
  }
}
