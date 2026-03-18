import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tipology } from './entities/tipology.entity';
import { Subtipology } from './entities/subtipology.entity';
import { Situation } from './entities/situation.entity';
import { RegulatoryRule } from './entities/regulatory-rule.entity';
import { RegulatoryAction } from './entities/regulatory-action.entity';
import { Persona } from './entities/persona.entity';
import { ResponseTemplate } from './entities/response-template.entity';
import { MandatoryInfoRule } from './entities/mandatory-info-rule.entity';
import { TipologyController } from './controllers/tipology.controller';
import { AdminConfigController } from './controllers/admin-config.controller';
import { AdminConfigService } from './services/admin-config.service';
import { SkillDefinition } from '../orquestracao/entities/skill-definition.entity';
import { CapabilityVersion } from '../orquestracao/entities/capability-version.entity';
import { LlmModelConfig } from '../base-de-conhecimento/entities/llm-model-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tipology,
      Subtipology,
      Situation,
      RegulatoryRule,
      RegulatoryAction,
      Persona,
      ResponseTemplate,
      MandatoryInfoRule,
      SkillDefinition,
      CapabilityVersion,
      LlmModelConfig,
    ]),
  ],
  controllers: [TipologyController, AdminConfigController],
  providers: [AdminConfigService],
  exports: [TypeOrmModule],
})
export class RegulatorioModule {}
