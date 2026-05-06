import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoriaModule } from '../memoria/memoria.module';
import { RegulatorioModule } from '../regulatorio/regulatorio.module';
import { LlmModelConfig } from './entities/llm-model-config.entity';
import { DocumentIngestionService } from './services/document-ingestion.service';
import { VectorSearchService } from './services/vector-search.service';
import { TemplateResolverService } from './services/template-resolver.service';
import { MandatoryInfoResolverService } from './services/mandatory-info-resolver.service';
import { KbManagerController } from './controllers/kb-manager.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LlmModelConfig]),
    MemoriaModule,       // provides KbDocument, KbDocumentVersion, KbChunk repos
    RegulatorioModule,   // provides ResponseTemplate, MandatoryInfoRule repos
  ],
  controllers: [KbManagerController],
  providers: [
    DocumentIngestionService,
    VectorSearchService,
    TemplateResolverService,
    MandatoryInfoResolverService,
  ],
  exports: [
    TypeOrmModule,       // exports LlmModelConfig repo for ModelSelectorService in IaModule
    DocumentIngestionService,
    VectorSearchService,
    TemplateResolverService,
    MandatoryInfoResolverService,
  ],
})
export class BaseDeConhecimentoModule {}
