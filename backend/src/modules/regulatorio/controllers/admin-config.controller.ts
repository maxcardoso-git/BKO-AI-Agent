import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../operacao/entities/user.entity';
import { AdminConfigService } from '../services/admin-config.service';
import { Persona } from '../entities/persona.entity';
import { ResponseTemplate } from '../entities/response-template.entity';
import { SkillDefinition } from '../../orquestracao/entities/skill-definition.entity';
import { CapabilityVersion } from '../../orquestracao/entities/capability-version.entity';
import { LlmModelConfig } from '../../base-de-conhecimento/entities/llm-model-config.entity';

@Controller()
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  // ─── Personas ─────────────────────────────────────────────────────────────

  @Get('admin/personas')
  @Roles(UserRole.ADMIN)
  listPersonas(): Promise<Persona[]> {
    return this.adminConfigService.listPersonas();
  }

  @Post('admin/personas')
  @Roles(UserRole.ADMIN)
  createPersona(@Body() body: Partial<Persona>): Promise<Persona> {
    return this.adminConfigService.createPersona(body);
  }

  @Patch('admin/personas/:id')
  @Roles(UserRole.ADMIN)
  updatePersona(
    @Param('id') id: string,
    @Body() body: Partial<Persona>,
  ): Promise<Persona> {
    return this.adminConfigService.updatePersona(id, body);
  }

  @Delete('admin/personas/:id')
  @Roles(UserRole.ADMIN)
  async deletePersona(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.adminConfigService.deletePersona(id);
    return { success: true };
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('admin/templates')
  @Roles(UserRole.ADMIN)
  listTemplates(): Promise<ResponseTemplate[]> {
    return this.adminConfigService.listTemplates();
  }

  @Post('admin/templates')
  @Roles(UserRole.ADMIN)
  createTemplate(@Body() body: Partial<ResponseTemplate>): Promise<ResponseTemplate> {
    return this.adminConfigService.createTemplate(body);
  }

  @Patch('admin/templates/:id')
  @Roles(UserRole.ADMIN)
  updateTemplate(
    @Param('id') id: string,
    @Body() body: Partial<ResponseTemplate>,
  ): Promise<ResponseTemplate> {
    return this.adminConfigService.updateTemplate(id, body);
  }

  // ─── Skills ───────────────────────────────────────────────────────────────

  @Get('admin/skills')
  @Roles(UserRole.ADMIN)
  listSkills(): Promise<SkillDefinition[]> {
    return this.adminConfigService.listSkills();
  }

  @Patch('admin/skills/:id')
  @Roles(UserRole.ADMIN)
  updateSkill(
    @Param('id') id: string,
    @Body() body: Partial<SkillDefinition>,
  ): Promise<SkillDefinition> {
    return this.adminConfigService.updateSkill(id, body);
  }

  // ─── Capabilities ─────────────────────────────────────────────────────────
  // Note: GET /api/admin/capabilities is owned by StepsDesignerController (returns Capability[])
  // This endpoint returns CapabilityVersion[] for the admin catalog page

  @Get('admin/capability-versions')
  @Roles(UserRole.ADMIN)
  listCapabilities(): Promise<CapabilityVersion[]> {
    return this.adminConfigService.listCapabilities();
  }

  @Patch('admin/capabilities/:id')
  @Roles(UserRole.ADMIN)
  updateCapability(
    @Param('id') id: string,
    @Body() body: Partial<CapabilityVersion>,
  ): Promise<CapabilityVersion> {
    return this.adminConfigService.updateCapability(id, body);
  }

  // ─── LLM Models ───────────────────────────────────────────────────────────

  @Get('admin/models')
  @Roles(UserRole.ADMIN)
  listModels(): Promise<LlmModelConfig[]> {
    return this.adminConfigService.listModels();
  }

  @Post('admin/models')
  @Roles(UserRole.ADMIN)
  createModel(@Body() body: Partial<LlmModelConfig>): Promise<LlmModelConfig> {
    return this.adminConfigService.createModel(body);
  }

  @Patch('admin/models/:id')
  @Roles(UserRole.ADMIN)
  updateModel(
    @Param('id') id: string,
    @Body() body: Partial<LlmModelConfig>,
  ): Promise<LlmModelConfig> {
    return this.adminConfigService.updateModel(id, body);
  }
}
