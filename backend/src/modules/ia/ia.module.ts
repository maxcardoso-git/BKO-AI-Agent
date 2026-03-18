import { Module } from '@nestjs/common';
import { BaseDeConhecimentoModule } from '../base-de-conhecimento/base-de-conhecimento.module';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { ModelSelectorService } from './services/model-selector.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { ComplaintParsingAgent } from './services/complaint-parsing.agent';
import { DraftGeneratorAgent } from './services/draft-generator.agent';

@Module({
  imports: [
    BaseDeConhecimentoModule, // provides LlmModelConfig repo, VectorSearchService, TemplateResolverService, MandatoryInfoResolverService
    RegulatorioModule,        // provides Persona repo (for future persona-based prompt building)
  ],
  providers: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
  ],
  exports: [
    ModelSelectorService,
    PromptBuilderService,
    ComplaintParsingAgent,
    DraftGeneratorAgent,
  ],
})
export class IaModule {}
