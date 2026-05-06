import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MandatoryInfoRule } from '../../regulatorio/entities/mandatory-info-rule.entity';

export interface ResolvedMandatoryField {
  fieldName: string;
  fieldLabel: string;
  description: string | null;
  validationRule: string | null;
  isRequired: boolean;
  sortOrder: number;
}

@Injectable()
export class MandatoryInfoResolverService {
  constructor(
    @InjectRepository(MandatoryInfoRule)
    private readonly ruleRepo: Repository<MandatoryInfoRule>,
  ) {}

  /**
   * Returns all active mandatory info rules for a given tipologyId and optional situationId.
   * Returns union of: rules matching tipologyId+situationId, tipologyId-only rules,
   * and global rules (null tipology). Deduplicates by fieldName, preferring more specific rules.
   */
  async resolve(
    tipologyId: string,
    situationId?: string | null,
  ): Promise<ResolvedMandatoryField[]> {
    // Load all potentially matching rules
    const query = this.ruleRepo
      .createQueryBuilder('r')
      .where('r."isActive" = true')
      .andWhere(
        '(r."tipologyId" = :tipologyId OR r."tipologyId" IS NULL)',
        { tipologyId },
      )
      .orderBy('r."sortOrder"', 'ASC');

    if (situationId) {
      query.andWhere(
        '(r."situationId" = :situationId OR r."situationId" IS NULL)',
        { situationId },
      );
    } else {
      query.andWhere('r."situationId" IS NULL');
    }

    const rules = await query.getMany();

    // Deduplicate by fieldName — more specific rule wins
    // Priority: tipologyId+situationId > tipologyId-only > global
    const deduped = new Map<string, MandatoryInfoRule>();
    for (const rule of rules) {
      const existing = deduped.get(rule.fieldName);
      if (!existing || this.specificity(rule) > this.specificity(existing)) {
        deduped.set(rule.fieldName, rule);
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({
        fieldName: r.fieldName,
        fieldLabel: r.fieldLabel,
        description: r.description,
        validationRule: r.validationRule,
        isRequired: r.isRequired,
        sortOrder: r.sortOrder,
      }));
  }

  private specificity(rule: MandatoryInfoRule): number {
    let score = 0;
    if (rule.tipologyId) score += 1;
    if (rule.situationId) score += 2;
    return score;
  }
}
