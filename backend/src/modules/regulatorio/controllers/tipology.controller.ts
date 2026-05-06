import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tipology } from '../entities/tipology.entity';
import { Subtipology } from '../entities/subtipology.entity';
import { RegulatoryRule } from '../entities/regulatory-rule.entity';
import { Public } from '../../auth/decorators/public.decorator';

@Controller()
export class TipologyController {
  constructor(
    @InjectRepository(Tipology)
    private readonly tipologyRepository: Repository<Tipology>,
    @InjectRepository(Subtipology)
    private readonly subtipologyRepository: Repository<Subtipology>,
    @InjectRepository(RegulatoryRule)
    private readonly ruleRepository: Repository<RegulatoryRule>,
  ) {}

  @Public()
  @Get('tipologies')
  async findAll() {
    const tipologies = await this.tipologyRepository.find({
      where: { isActive: true },
      order: { label: 'ASC' },
    });

    return tipologies.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.label,
      description: t.description,
      defaultActionType: 'responder',
      slaAberta: t.slaBusinessDays,
      slaPedido: t.slaBusinessDays,
      slaReaberta: Math.ceil(t.slaBusinessDays * 0.6),
    }));
  }

  @Public()
  @Get('situacoes')
  async findSituacoes() {
    const subtipologies = await this.subtipologyRepository.find({
      where: { isActive: true },
      order: { label: 'ASC' },
    });

    return subtipologies.map((s) => ({
      id: s.id,
      tipologiaId: s.tipologyId,
      key: s.key,
      name: s.label,
      description: s.description,
      risco: 'medium' as const,
    }));
  }

  @Public()
  @Get('regulatory/rules')
  async findRules() {
    const rules = await this.ruleRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });

    return rules.map((r) => ({
      id: r.id,
      tipologiaId: r.tipologyId,
      ruleType: r.ruleType,
      description: r.description,
      validationExpression: r.code,
      isActive: r.isActive,
    }));
  }

  @Public()
  @Get('regulatory/actions')
  async findActions() {
    return [];
  }
}
