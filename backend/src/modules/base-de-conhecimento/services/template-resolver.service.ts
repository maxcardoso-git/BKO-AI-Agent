import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseTemplate } from '../../regulatorio/entities/response-template.entity';

export interface ResolvedTemplate {
  id: string;
  name: string;
  templateContent: string;
  version: number;
  matchType: 'tipology_situation' | 'tipology_only' | 'default';
}

@Injectable()
export class TemplateResolverService {
  constructor(
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
  ) {}

  /**
   * Resolves the best-matching IQI template for a given tipology and optional situation.
   * Priority: 1) tipologyId + situationId match, 2) tipologyId-only match, 3) null tipology (default).
   * Returns null if no template found.
   */
  async resolve(
    tipologyId: string,
    situationId?: string | null,
  ): Promise<ResolvedTemplate | null> {
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
