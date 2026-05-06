import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tipology } from '../../regulatorio/entities/tipology.entity';
import { Situation } from '../../regulatorio/entities/situation.entity';
import { RegulatoryRule, RegulatoryRuleType } from '../../regulatorio/entities/regulatory-rule.entity';
import { RegulatoryAction } from '../../regulatorio/entities/regulatory-action.entity';
import { Capability } from '../entities/capability.entity';
import { CapabilityVersion } from '../entities/capability-version.entity';
import type { Complaint } from '../../operacao/entities/complaint.entity';

@Injectable()
export class RegulatoryOrchestrationService {
  constructor(
    @InjectRepository(Tipology)
    private readonly tipologyRepo: Repository<Tipology>,

    @InjectRepository(Situation)
    private readonly situationRepo: Repository<Situation>,

    @InjectRepository(RegulatoryRule)
    private readonly ruleRepo: Repository<RegulatoryRule>,

    @InjectRepository(RegulatoryAction)
    private readonly regulatoryActionRepo: Repository<RegulatoryAction>,

    @InjectRepository(Capability)
    private readonly capabilityRepo: Repository<Capability>,

    @InjectRepository(CapabilityVersion)
    private readonly capabilityVersionRepo: Repository<CapabilityVersion>,
  ) {}

  /**
   * Computes SLA deadline based on complaint creation date and regulatory configuration.
   * Uses situation.slaOverrideDays if set, otherwise tipology.slaBusinessDays.
   * Business days calculation skips Saturday (6) and Sunday (0). No holiday handling in Phase 3.
   */
  computeSla(
    createdAt: Date,
    tipology: Tipology,
    situation: Situation | null,
  ): { slaDeadline: Date; slaBusinessDays: number; isOverdue: boolean } {
    const slaBusinessDays = situation?.slaOverrideDays ?? tipology.slaBusinessDays;
    const slaDeadline = this.addBusinessDays(createdAt, slaBusinessDays);
    const isOverdue = new Date() > slaDeadline;
    return { slaDeadline, slaBusinessDays, isOverdue };
  }

  /**
   * Selects the active and current capability version for a given tipologyId.
   * Falls back to a generic capability (tipologyId IS NULL) if no tipology-specific one exists.
   * Throws 422 if no capability is found at all, or if no current+active version found.
   */
  async selectCapabilityVersion(tipologyId: string): Promise<CapabilityVersion> {
    let capability = await this.capabilityRepo.findOne({
      where: { tipologyId, isActive: true },
      relations: ['versions'],
    });

    if (!capability) {
      capability = await this.capabilityRepo.findOne({
        where: { tipologyId: null as any, isActive: true },
        relations: ['versions'],
      });
    }

    if (!capability) {
      throw new HttpException(
        'No active capability found for tipologyId: ' + tipologyId,
        422,
      );
    }

    const currentVersion = capability.versions.find(
      (v) => v.isCurrent && v.isActive,
    );

    if (!currentVersion) {
      throw new HttpException(
        'No current active version for capability: ' + capability.key,
        422,
      );
    }

    return currentVersion;
  }

  /**
   * Validates all BLOCKING regulatory rules against the complaint and requested action.
   * Returns { passed: true } when no violations are found, { passed: false, violations } otherwise.
   */
  async validatePolicyRules(
    complaint: Complaint,
    action: 'advance' | 'finalizar',
  ): Promise<{ passed: boolean; violations: string[] }> {
    const blockingRules = await this.ruleRepo.find({
      where: { ruleType: RegulatoryRuleType.BLOCKING, isActive: true },
    });

    const violations: string[] = [];

    for (const rule of blockingRules) {
      // Skip rule if it targets a specific tipology that doesn't match the complaint
      if (rule.tipologyId && rule.tipologyId !== complaint.tipologyId) {
        continue;
      }

      // Skip rule if it targets a specific action that doesn't match the requested action
      if (
        rule.metadata?.blocks_action &&
        rule.metadata.blocks_action !== action
      ) {
        continue;
      }

      // Evaluate applicable rules
      if (rule.metadata?.requires_complete_checklist) {
        // Phase 4: check actual checklist completion
        continue;
      }

      // Conservative: block if we don't know how to evaluate this rule
      violations.push(rule.title);
    }

    return { passed: violations.length === 0, violations };
  }

  /**
   * Adds business days to a date, skipping weekends.
   * No holiday handling in Phase 3.
   */
  private addBusinessDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let remainingDays = days;

    while (remainingDays > 0) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remainingDays--;
      }
    }

    return result;
  }
}
