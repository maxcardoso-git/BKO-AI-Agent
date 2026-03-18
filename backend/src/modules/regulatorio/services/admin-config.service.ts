import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Persona } from '../entities/persona.entity';
import { ResponseTemplate } from '../entities/response-template.entity';
import { SkillDefinition } from '../../orquestracao/entities/skill-definition.entity';
import { CapabilityVersion } from '../../orquestracao/entities/capability-version.entity';
import { LlmModelConfig } from '../../base-de-conhecimento/entities/llm-model-config.entity';

@Injectable()
export class AdminConfigService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    @InjectRepository(ResponseTemplate)
    private readonly templateRepo: Repository<ResponseTemplate>,
    @InjectRepository(SkillDefinition)
    private readonly skillRepo: Repository<SkillDefinition>,
    @InjectRepository(CapabilityVersion)
    private readonly capabilityRepo: Repository<CapabilityVersion>,
    @InjectRepository(LlmModelConfig)
    private readonly modelRepo: Repository<LlmModelConfig>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // ─── Personas ─────────────────────────────────────────────────────────────

  listPersonas(): Promise<Persona[]> {
    return this.personaRepo.find({ order: { createdAt: 'ASC' } });
  }

  async createPersona(dto: Partial<Persona>): Promise<Persona> {
    const persona = await this.personaRepo.save(this.personaRepo.create(dto));
    await this.syncStyleMemory(persona.tipologyId ?? null, dto.requiredExpressions ?? [], dto.forbiddenExpressions ?? []);
    return persona;
  }

  async updatePersona(id: string, dto: Partial<Persona>): Promise<Persona> {
    await this.personaRepo.update(id, dto);
    const persona = await this.personaRepo.findOneOrFail({ where: { id } });
    const tipologyId = dto.tipologyId ?? persona.tipologyId ?? null;
    // Delete old style_memory rows for this tipologyId then re-insert
    if (tipologyId) {
      await this.dataSource.query(
        `DELETE FROM style_memory WHERE "tipologyId" = $1`,
        [tipologyId],
      );
    }
    await this.syncStyleMemory(tipologyId, dto.requiredExpressions ?? [], dto.forbiddenExpressions ?? []);
    return persona;
  }

  async deletePersona(id: string): Promise<void> {
    await this.personaRepo.delete(id);
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  listTemplates(): Promise<ResponseTemplate[]> {
    return this.templateRepo.find({ order: { version: 'DESC' } });
  }

  async createTemplate(dto: Partial<ResponseTemplate>): Promise<ResponseTemplate> {
    return this.templateRepo.save(this.templateRepo.create(dto));
  }

  async updateTemplate(id: string, dto: Partial<ResponseTemplate>): Promise<ResponseTemplate> {
    const existing = await this.templateRepo.findOneOrFail({ where: { id } });
    const updated = { ...existing, ...dto, version: (existing.version ?? 0) + 1 };
    return this.templateRepo.save(updated);
  }

  // ─── Skills ───────────────────────────────────────────────────────────────

  listSkills(): Promise<SkillDefinition[]> {
    return this.skillRepo.find({ order: { key: 'ASC' } });
  }

  async updateSkill(id: string, dto: Partial<SkillDefinition>): Promise<SkillDefinition> {
    const existing = await this.skillRepo.findOneOrFail({ where: { id } });
    return this.skillRepo.save({ ...existing, ...dto });
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────

  listCapabilities(): Promise<CapabilityVersion[]> {
    return this.capabilityRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateCapability(id: string, dto: Partial<CapabilityVersion>): Promise<CapabilityVersion> {
    const existing = await this.capabilityRepo.findOneOrFail({ where: { id } });
    return this.capabilityRepo.save({ ...existing, ...dto });
  }

  // ─── LLM Models ───────────────────────────────────────────────────────────

  listModels(): Promise<LlmModelConfig[]> {
    return this.modelRepo.find({ order: { functionalityType: 'ASC' } });
  }

  async createModel(dto: Partial<LlmModelConfig>): Promise<LlmModelConfig> {
    return this.modelRepo.save(this.modelRepo.create(dto));
  }

  async updateModel(id: string, dto: Partial<LlmModelConfig>): Promise<LlmModelConfig> {
    const existing = await this.modelRepo.findOneOrFail({ where: { id } });
    return this.modelRepo.save({ ...existing, ...dto });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async syncStyleMemory(
    tipologyId: string | null,
    requiredExpressions: string[],
    forbiddenExpressions: string[],
  ): Promise<void> {
    try {
      for (const expr of requiredExpressions) {
        await this.dataSource.query(
          `INSERT INTO style_memory ("id","tipologyId","expressionType","expressionText","isActive","createdAt")
           VALUES (gen_random_uuid(),$1,$2,$3,true,NOW())`,
          [tipologyId, 'approved', expr],
        );
      }
      for (const expr of forbiddenExpressions) {
        await this.dataSource.query(
          `INSERT INTO style_memory ("id","tipologyId","expressionType","expressionText","isActive","createdAt")
           VALUES (gen_random_uuid(),$1,$2,$3,true,NOW())`,
          [tipologyId, 'forbidden', expr],
        );
      }
    } catch {
      // StyleMemory sync is supplementary — do not fail persona creation/update
    }
  }
}
