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
    ]),
  ],
  controllers: [TipologyController],
  exports: [TypeOrmModule],
})
export class RegulatorioModule {}
