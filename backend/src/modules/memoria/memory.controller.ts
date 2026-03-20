import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../operacao/entities/user.entity';
import { CaseMemory } from './entities/case-memory.entity';
import { HumanFeedbackMemory } from './entities/human-feedback-memory.entity';
import { StyleMemory } from './entities/style-memory.entity';

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

  // ─── Cases ────────────────────────────────────────────────────────────────

  @Get('cases')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async listCases(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('includeInactive') includeInactive?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);
    const showAll = includeInactive === 'true';

    const items = await this.caseRepo.find({
      where: showAll ? {} : { isActive: true },
      relations: ['complaint'],
      order: { createdAt: 'DESC' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return items.map((c) => ({
      id: c.id,
      complaintId: c.complaintId,
      tipologiaId: c.tipologyId,
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
  @Roles(UserRole.ADMIN)
  async deactivateCase(@Param('id') id: string) {
    await this.caseRepo.update(id, { isActive: false });
    return { success: true };
  }

  @Patch('cases/:id/activate')
  @Roles(UserRole.ADMIN)
  async activateCase(@Param('id') id: string) {
    await this.caseRepo.update(id, { isActive: true });
    return { success: true };
  }

  // ─── Feedback ─────────────────────────────────────────────────────────────

  @Get('feedback')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async listFeedback(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);

    const items = await this.feedbackRepo.find({
      order: { createdAt: 'DESC' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    });

    return items.map((f) => ({
      id: f.id,
      humanReviewId: f.complaintId,
      correctionSummary: f.diffDescription,
      tipologiaId: f.tipologyId,
      correctionCategory: f.correctionCategory,
      correctionWeight: f.correctionWeight,
      createdAt: f.createdAt,
    }));
  }

  // ─── Style ────────────────────────────────────────────────────────────────

  @Get('style')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async listStyle(
    @Query('tipologiaId') tipologiaId?: string,
    @Query('limit') limit = '100',
  ) {
    const limitNum = Math.min(500, parseInt(limit, 10) || 100);

    const items = await this.styleRepo.find({
      where: tipologiaId ? { tipologyId: tipologiaId } : {},
      order: { createdAt: 'DESC' },
      take: limitNum,
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
