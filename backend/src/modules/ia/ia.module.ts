import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([LlmCall, TokenUsage]), // direct import avoids circular dep with ExecucaoModule
    BaseDeConhecimentoModule, // provides LlmModelConfig repo, VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
    RegulatorioModule,        // provides Persona repo (for future persona-based prompt building)
  ],
  providers: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
    ComplianceEvaluatorAgent,
    FinalResponseComposerAgent,
    TokenUsageTrackerService,
  ],
  exports: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
    ComplianceEvaluatorAgent,
    FinalResponseComposerAgent,
    TokenUsageTrackerService,
  ],
})
export class IaModule {}
