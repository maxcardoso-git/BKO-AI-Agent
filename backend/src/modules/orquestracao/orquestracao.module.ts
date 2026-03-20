import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { Capability } from './entities/capability.entity';
import { CapabilityVersion } from './entities/capability-version.entity';
import { StepDefinition } from './entities/step-definition.entity';
import { StepTransitionRule } from './entities/step-transition-rule.entity';
import { SkillDefinition } from './entities/skill-definition.entity';
import { StepSkillBinding } from './entities/step-skill-binding.entity';
import { Resource } from './entities/resource.entity';
import { RegulatoryOrchestrationService } from './services/regulatory-orchestration.service';
import { StepsDesignerService } from './services/steps-designer.service';
import { ResourceService } from './services/resource.service';
import { StepsDesignerController } from './controllers/steps-designer.controller';
import { ResourceController } from './controllers/resource.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Capability,
      CapabilityVersion,
      StepDefinition,
      StepTransitionRule,
      SkillDefinition,
      StepSkillBinding,
      Resource,
    ]),
    RegulatorioModule,
  ],
  controllers: [StepsDesignerController, ResourceController],
  providers: [RegulatoryOrchestrationService, StepsDesignerService, ResourceService],
  exports: [TypeOrmModule, RegulatoryOrchestrationService, StepsDesignerService, ResourceService],
})
export class OrquestracaoModule {}
