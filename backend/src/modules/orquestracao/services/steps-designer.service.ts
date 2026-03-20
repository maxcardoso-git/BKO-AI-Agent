import { Injectable, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Capability } from '../entities/capability.entity';
import { CapabilityVersion } from '../entities/capability-version.entity';
import { StepDefinition } from '../entities/step-definition.entity';
import { StepSkillBinding } from '../entities/step-skill-binding.entity';
import { StepTransitionRule } from '../entities/step-transition-rule.entity';
import { SkillDefinition } from '../entities/skill-definition.entity';
import { StepItemDto, TransitionRuleDto } from '../dto/update-steps.dto';

@Injectable()
export class StepsDesignerService {
  constructor(
    @InjectRepository(Capability)
    private readonly capabilityRepo: Repository<Capability>,

    @InjectRepository(CapabilityVersion)
    private readonly capVersionRepo: Repository<CapabilityVersion>,

    @InjectRepository(StepDefinition)
    private readonly stepDefRepo: Repository<StepDefinition>,

    @InjectRepository(StepSkillBinding)
    private readonly bindingRepo: Repository<StepSkillBinding>,

    @InjectRepository(StepTransitionRule)
    private readonly stepTransitionRuleRepo: Repository<StepTransitionRule>,

    @InjectRepository(SkillDefinition)
    private readonly skillDefRepo: Repository<SkillDefinition>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lists all capabilities with their active versions and step definitions.
   * Steps are ordered by stepOrder within each version.
   */
  async listCapabilities(): Promise<Capability[]> {
    return this.capabilityRepo
      .createQueryBuilder('cap')
      .leftJoinAndSelect('cap.versions', 'ver')
      .leftJoinAndSelect('ver.steps', 'step')
      .orderBy('cap.name', 'ASC')
      .addOrderBy('ver.version', 'DESC')
      .addOrderBy('step.stepOrder', 'ASC')
      .getMany();
  }

  /**
   * Returns a single capability version with its step definitions (ordered by stepOrder).
   */
  async getCapabilityVersion(verId: string): Promise<CapabilityVersion> {
    const ver = await this.capVersionRepo.findOne({
      where: { id: verId },
      relations: ['steps'],
    });
    if (!ver) {
      throw new HttpException('CapabilityVersion not found', 404);
    }
    // Sort steps by stepOrder in memory (TypeORM find relations don't guarantee order)
    if (ver.steps) {
      ver.steps.sort((a, b) => a.stepOrder - b.stepOrder);
    }
    return ver;
  }

  /**
   * Atomically reorders and upserts StepDefinition rows within a capability version.
   * stepOrder is assigned sequentially (1-based) from the input array order.
   * Also upserts StepSkillBinding when skillKey is provided.
   */
  async updateSteps(
    verId: string,
    steps: StepItemDto[],
  ): Promise<StepDefinition[]> {
    return this.dataSource.transaction(async (manager) => {
      const stepDefRepo = manager.getRepository(StepDefinition);
      const bindingRepo = manager.getRepository(StepSkillBinding);
      const skillDefRepo = manager.getRepository(SkillDefinition);

      const savedSteps: StepDefinition[] = [];

      for (let i = 0; i < steps.length; i++) {
        const dto = steps[i];
        const newOrder = i + 1;

        // Upsert StepDefinition by key within this capability version
        let existing = await stepDefRepo.findOne({
          where: { capabilityVersionId: verId, key: dto.key },
        });

        if (existing) {
          existing.name = dto.name;
          existing.stepOrder = newOrder;
          existing.isHumanRequired = dto.isHumanRequired;
          existing.isActive = dto.isActive ?? true;
          existing = await stepDefRepo.save(existing);
        } else {
          existing = await stepDefRepo.save(
            stepDefRepo.create({
              capabilityVersionId: verId,
              key: dto.key,
              name: dto.name,
              stepOrder: newOrder,
              isHumanRequired: dto.isHumanRequired,
              isActive: dto.isActive ?? true,
            }),
          );
        }

        // Upsert StepSkillBinding when skillKey is provided
        if (dto.skillKey != null) {
          const skillDef = await skillDefRepo.findOne({
            where: { key: dto.skillKey },
          });
          if (skillDef) {
            const existingBinding = await bindingRepo.findOne({
              where: { stepDefinitionId: existing.id, isActive: true },
            });
            if (existingBinding) {
              existingBinding.llmModel = dto.llmModel ?? null;
              existingBinding.skillDefinitionId = skillDef.id;
              await bindingRepo.save(existingBinding);
            } else {
              await bindingRepo.save(
                bindingRepo.create({
                  stepDefinitionId: existing.id,
                  skillDefinitionId: skillDef.id,
                  llmModel: dto.llmModel ?? null,
                  isActive: true,
                }),
              );
            }
          }
        }

        savedSteps.push(existing);
      }

      return savedSteps;
    });
  }

  /**
   * Returns all transition rules for a given step definition, ordered by priority.
   */
  async getTransitions(stepId: string): Promise<StepTransitionRule[]> {
    return this.stepTransitionRuleRepo.find({
      where: { stepDefinitionId: stepId },
      order: { priority: 'ASC' },
    });
  }

  /**
   * Atomically replaces all StepTransitionRule rows for a step.
   * Delete-and-insert strategy prevents orphaned rules.
   */
  async updateTransitions(
    stepId: string,
    transitions: TransitionRuleDto[],
  ): Promise<StepTransitionRule[]> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(StepTransitionRule);

      await repo.delete({ stepDefinitionId: stepId });

      if (transitions.length === 0) {
        return [];
      }

      const newRules = transitions.map((t) =>
        repo.create({
          stepDefinitionId: stepId,
          conditionType: t.conditionType,
          conditionExpression: t.conditionExpression,
          targetStepKey: t.targetStepKey,
          priority: t.priority ?? 0,
          description: t.description ?? null,
        }),
      );

      return repo.save(newRules);
    });
  }

  // ─── Version-centric endpoints (used by Steps Designer UI) ───────────────

  /**
   * Returns flat list of capability versions as selectors for the UI dropdown.
   */
  async listVersionSelectors(): Promise<
    { id: string; capabilityKey: string; capabilityName: string; version: number; description: string | null; isActive: boolean }[]
  > {
    const caps = await this.capabilityRepo
      .createQueryBuilder('cap')
      .leftJoinAndSelect('cap.versions', 'ver')
      .orderBy('cap.name', 'ASC')
      .addOrderBy('ver.version', 'DESC')
      .getMany();

    return caps.flatMap((cap) =>
      cap.versions.map((ver) => ({
        id: ver.id,
        capabilityKey: cap.key,
        capabilityName: cap.name,
        version: ver.version,
        description: ver.description,
        isActive: ver.isActive,
      })),
    );
  }

  /**
   * Returns a capability version with its steps (ordered by stepOrder).
   */
  async getVersionWithSteps(verId: string): Promise<CapabilityVersion> {
    return this.getCapabilityVersion(verId);
  }

  /**
   * Returns all transitions for all steps in a version, enriched with fromStepKey.
   */
  async getVersionTransitions(
    verId: string,
  ): Promise<(StepTransitionRule & { fromStepKey: string })[]> {
    const steps = await this.stepDefRepo.find({
      where: { capabilityVersionId: verId },
    });

    const stepIds = steps.map((s) => s.id);
    if (stepIds.length === 0) return [];

    const stepKeyMap = new Map(steps.map((s) => [s.id, s.key]));

    const transitions = await this.stepTransitionRuleRepo
      .createQueryBuilder('tr')
      .where('tr.stepDefinitionId IN (:...ids)', { ids: stepIds })
      .orderBy('tr.priority', 'ASC')
      .getMany();

    return transitions.map((t) => ({
      ...t,
      fromStepKey: stepKeyMap.get(t.stepDefinitionId) ?? '',
    }));
  }

  /**
   * Replaces all transitions for a version.
   * Accepts flat list with fromStepKey + targetStepKey.
   */
  async updateVersionTransitions(
    verId: string,
    transitions: { fromStepKey: string; targetStepKey: string; conditionType: string; conditionExpression?: Record<string, unknown>; priority?: number }[],
  ): Promise<StepTransitionRule[]> {
    const steps = await this.stepDefRepo.find({
      where: { capabilityVersionId: verId },
    });

    const stepIdMap = new Map(steps.map((s) => [s.key, s.id]));

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(StepTransitionRule);

      // Delete all existing transitions for this version's steps
      const stepIds = steps.map((s) => s.id);
      if (stepIds.length > 0) {
        await repo
          .createQueryBuilder()
          .delete()
          .where('stepDefinitionId IN (:...ids)', { ids: stepIds })
          .execute();
      }

      if (transitions.length === 0) return [];

      const newRules = transitions
        .map((t) => {
          const stepDefinitionId = stepIdMap.get(t.fromStepKey);
          if (!stepDefinitionId) return null;
          return repo.create({
            stepDefinitionId,
            targetStepKey: t.targetStepKey,
            conditionType: t.conditionType,
            conditionExpression: t.conditionExpression ?? {},
            priority: t.priority ?? 0,
          });
        })
        .filter((r): r is StepTransitionRule => r !== null);

      return repo.save(newRules);
    });
  }
}
