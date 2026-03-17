import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KbDocument } from './entities/kb-document.entity';
import { KbDocumentVersion } from './entities/kb-document-version.entity';
import { KbChunk } from './entities/kb-chunk.entity';
import { CaseMemory } from './entities/case-memory.entity';
import { HumanFeedbackMemory } from './entities/human-feedback-memory.entity';
import { StyleMemory } from './entities/style-memory.entity';

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
  ],
  exports: [TypeOrmModule],
})
export class MemoriaModule {}
