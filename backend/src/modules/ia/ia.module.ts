import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaseDeConhecimentoModule } from '../base-de-conhecimento/base-de-conhecimento.module';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { LlmCall } from '../execucao/entities/llm-call.entity';
import { TokenUsage } from '../execucao/entities/token-usage.entity';
import { ModelSelectorService } from './services/model-selector.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { ComplaintParsingAgent } from './services/complaint-parsing.agent';
import { DraftGeneratorAgent } from './services/draft-generator.agent';
import { ComplianceEvaluatorAgent } from './services/compliance-evaluator.agent';
import { FinalResponseComposerAgent } from './services/final-response-composer.agent';
import { TokenUsageTrackerService } from './services/token-usage-tracker.service';
import { SmartNoteService } from './services/smart-note.service';
import { SmartNoteController } from './controllers/smart-note.controller';
import { Complaint } from '../operacao/entities/complaint.entity';
import { ResponseTemplate } from '../regulatorio/entities/response-template.entity';
import { Tipology } from '../regulatorio/entities/tipology.entity';
import { Situation } from '../regulatorio/entities/situation.entity';
import { Persona } from '../regulatorio/entities/persona.entity';
import { TemplateFieldsExtractorService } from './services/template-fields-extractor.service';
import { TemplateFieldsAdminController } from './controllers/template-fields-admin.controller';
import { MandatoryFieldExtractorAgent } from './services/mandatory-field-extractor.agent';
import { TemplateSelectorAgent } from './services/template-selector.agent';

@Module({
  imports: [
    TypeOrmModule.forFeature([LlmCall, TokenUsage, Complaint, ResponseTemplate, Tipology, Situation, Persona]),
    forwardRef(() => BaseDeConhecimentoModule), // forwardRef: IaModule -> BDCM -> MemoriaModule -> forwardRef(IaModule)
    RegulatorioModule,        // provides Persona repo (for future persona-based prompt building)
  ],
  controllers: [SmartNoteController, TemplateFieldsAdminController],
  providers: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
    ComplianceEvaluatorAgent,
    FinalResponseComposerAgent,
    TokenUsageTrackerService,
    SmartNoteService,
    TemplateFieldsExtractorService,
    MandatoryFieldExtractorAgent,
    TemplateSelectorAgent,
  ],
  exports: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
    ComplianceEvaluatorAgent,
    FinalResponseComposerAgent,
    TokenUsageTrackerService,
    SmartNoteService,
    TemplateFieldsExtractorService,
    MandatoryFieldExtractorAgent,
    TemplateSelectorAgent,
  ],
})
export class IaModule {}
