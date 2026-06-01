import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { MandatoryInfoRule } from '../entities/mandatory-info-rule.entity';

interface MandatoryInfoRuleDto {
  id: string;
  fieldName: string;
  fieldLabel: string;
  description: string | null;
  validationRule: string | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  tipologyId: string | null;
  tipologyKey: string | null;
  tipologyLabel: string | null;
  situationId: string | null;
  situationKey: string | null;
  situationLabel: string | null;
  scope: 'global' | 'tipology' | 'tipology+situation';
  createdAt: string;
  updatedAt: string;
}

@Controller('admin/mandatory-info-rules')
export class MandatoryInfoRuleController {
  constructor(
    @InjectRepository(MandatoryInfoRule)
    private readonly repo: Repository<MandatoryInfoRule>,
  ) {}

  /** GET /api/admin/mandatory-info-rules — lists every rule with its tipology
   *  and situation joined (so the UI can show context without extra round-trips).
   *  Optional ?onlyActive=1 filters out disabled rules. ADMIN + SUPERVISOR. */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async list(@Query('onlyActive') onlyActive?: string): Promise<MandatoryInfoRuleDto[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoin('r.tipology', 't')
      .leftJoin('r.situation', 's')
      .addSelect(['t.id', 't.key', 't.label'])
      .addSelect(['s.id', 's.key', 's.label'])
      .orderBy('r."sortOrder"', 'ASC')
      .addOrderBy('r."fieldName"', 'ASC');

    if (onlyActive === '1' || onlyActive === 'true') {
      qb.where('r."isActive" = true');
    }

    const rows = await qb.getMany();
    return rows.map((r) => ({
      id: r.id,
      fieldName: r.fieldName,
      fieldLabel: r.fieldLabel,
      description: r.description,
      validationRule: r.validationRule,
      isRequired: r.isRequired,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      tipologyId: r.tipologyId,
      tipologyKey: r.tipology?.key ?? null,
      tipologyLabel: r.tipology?.label ?? null,
      situationId: r.situationId,
      situationKey: r.situation?.key ?? null,
      situationLabel: r.situation?.label ?? null,
      scope: r.situationId ? 'tipology+situation' : r.tipologyId ? 'tipology' : 'global',
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}
