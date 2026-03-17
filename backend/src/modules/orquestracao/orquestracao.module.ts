import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { Capability } from './entities/capability.entity';
import { CapabilityVersion } from './entities/capability-version.entity';
import { StepDefinition } from './entities/step-definition.entity';
import { StepTransitionRule } from './entities/step-transition-rule.entity';
import { SkillDefinition } from './entities/skill-definition.entity';
import { StepSkillBinding } from './entities/step-skill-binding.entity';
import { RegulatoryOrchestrationService } from './services/regulatory-orchestration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Capability,
      CapabilityVersion,
      StepDefinition,
      StepTransitionRule,
      SkillDefinition,
      StepSkillBinding,
    ]),
    RegulatorioModule,
  ],
  providers: [RegulatoryOrchestrationService],
  exports: [TypeOrmModule, RegulatoryOrchestrationService],
})
export class OrquestracaoModule {}
