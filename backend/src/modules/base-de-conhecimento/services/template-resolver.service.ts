import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseTemplate } from '../../regulatorio/entities/response-template.entity';
import { Complaint } from '../../operacao/entities/complaint.entity';

export interface ResolvedTemplate {
  id: string;
  name: string;
  templateContent: string;
  version: number;
  matchType: 'tipology_situation' | 'tipology_only' | 'default' | 'operator_override' | 'llm_selected';
}

@Injectable()
export class TemplateResolverService {
  constructor(
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
  ) {}

  /**
   * Resolves the best-matching IQI template for a given tipology and optional situation.
   * Priority: 0) operator override on the complaint (when complaintId provided),
   *          1) tipologyId + situationId match,
   *          2) tipologyId-only match,
   *          3) null tipology (default).
   * Returns null if no template found.
   */
  /**
   * Returns the operator-forced template for a complaint, if any. Exposed so
   * the IQI skill can honor the override before running LLM-based selection.
   */
  async resolveOverride(
    complaintId?: string | null,
  ): Promise<ResolvedTemplate | null> {
    if (!complaintId) return null;
    const complaint = await this.complaintRepo.findOne({
      where: { id: complaintId },
      select: ['id', 'templateOverrideId'],
    });
    if (!complaint?.templateOverrideId) return null;
    const forced = await this.templateRepo.findOne({
      where: { id: complaint.templateOverrideId },
    });
    if (!forced) return null;
    return {
      id: forced.id,
      name: forced.name,
      templateContent: forced.templateContent,
      version: forced.version,
      matchType: 'operator_override',
    };
  }

  async resolve(
    tipologyId: string,
    situationId?: string | null,
    complaintId?: string | null,
  ): Promise<ResolvedTemplate | null> {
    // 0. Operator override wins regardless of tipology/situation
    const override = await this.resolveOverride(complaintId);
    if (override) return override;

    // 1. Try exact match: tipology + situation
    if (situationId) {
      const exact = await this.templateRepo.findOne({
        where: { tipologyId, situationId, isActive: true },
        order: { version: 'DESC' },
      });
      if (exact) {
        return {
          id: exact.id,
          name: exact.name,
          templateContent: exact.templateContent,
          version: exact.version,
          matchType: 'tipology_situation',
        };
      }
    }

    // 2. Try tipology-only match (situationId IS NULL)
    const tipologyOnly = await this.templateRepo
      .createQueryBuilder('t')
      .where('t."tipologyId" = :tipologyId', { tipologyId })
      .andWhere('t."situationId" IS NULL')
      .andWhere('t."isActive" = true')
      .orderBy('t.version', 'DESC')
      .getOne();

    if (tipologyOnly) {
      return {
        id: tipologyOnly.id,
        name: tipologyOnly.name,
        templateContent: tipologyOnly.templateContent,
        version: tipologyOnly.version,
        matchType: 'tipology_only',
      };
    }

    // 3. Try default template (no tipology)
    const defaultTemplate = await this.templateRepo
      .createQueryBuilder('t')
      .where('t."tipologyId" IS NULL')
      .andWhere('t."isActive" = true')
      .orderBy('t.version', 'DESC')
      .getOne();

    if (defaultTemplate) {
      return {
        id: defaultTemplate.id,
        name: defaultTemplate.name,
        templateContent: defaultTemplate.templateContent,
        version: defaultTemplate.version,
        matchType: 'default',
      };
    }

    return null;
  }
}
