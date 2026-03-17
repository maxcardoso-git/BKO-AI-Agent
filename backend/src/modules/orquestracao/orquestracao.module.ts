import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Capability } from './entities/capability.entity';
import { CapabilityVersion } from './entities/capability-version.entity';
import { StepDefinition } from './entities/step-definition.entity';
import { StepTransitionRule } from './entities/step-transition-rule.entity';
import { SkillDefinition } from './entities/skill-definition.entity';
import { StepSkillBinding } from './entities/step-skill-binding.entity';

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
  ],
  exports: [TypeOrmModule],
})
export class OrquestracaoModule {}
