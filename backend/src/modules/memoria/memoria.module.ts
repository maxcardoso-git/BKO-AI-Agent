import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KbDocument } from './entities/kb-document.entity';
import { KbDocumentVersion } from './entities/kb-document-version.entity';
import { KbChunk } from './entities/kb-chunk.entity';
import { CaseMemory } from './entities/case-memory.entity';
import { HumanFeedbackMemory } from './entities/human-feedback-memory.entity';
import { StyleMemory } from './entities/style-memory.entity';
import { IaModule } from '../ia/ia.module';
import { MemoryRetrievalService } from './services/memory-retrieval.service';
import { MemoryFeedbackService } from './services/memory-feedback.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KbDocument,
      KbDocumentVersion,
      KbChunk,
      CaseMemory,
      HumanFeedbackMemory,
      StyleMemory,
    ]),
    forwardRef(() => IaModule), // forwardRef breaks circular: MemoriaModule -> IaModule -> BaseDeConhecimentoModule -> MemoriaModule
  ],
  providers: [MemoryRetrievalService, MemoryFeedbackService],
  exports: [MemoryRetrievalService, MemoryFeedbackService, TypeOrmModule],
})
export class MemoriaModule {}
