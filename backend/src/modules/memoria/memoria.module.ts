import { Module } from '@nestjs/common';

/**
 * Memoria module — kb_document, kb_document_version, kb_chunk (pgvector),
 * case_memory (pgvector), human_feedback_memory, style_memory
 * Entities and services will be added in Plan 02 (domain schema).
 */
@Module({
  imports: [],
  exports: [],
})
export class MemoriaModule {}
