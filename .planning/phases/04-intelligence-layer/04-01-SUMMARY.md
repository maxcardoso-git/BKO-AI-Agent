---
phase: 04-intelligence-layer
plan: 01
subsystem: ai-knowledge-base
tags: [pgvector, openai, pdf-parse, langchain, rag, vector-search, llm-config, embeddings, nestjs]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: KbDocument, KbDocumentVersion, KbChunk entities + pgvector bootstrap
  - phase: 02-access-layer
    provides: RegulatorioModule with ResponseTemplate and MandatoryInfoRule entities
provides:
  - LlmModelConfig entity + migration 1773774007000 (llm_model_config table + IVFFlat cosine index)
  - DocumentIngestionService (PDF extract -> RecursiveCharacterTextSplitter 800/100 -> embedMany -> kb_chunk raw SQL insert)
  - VectorSearchService (pgvector cosine search, similarity = 1 - distance, ORDER BY ASC)
  - TemplateResolverService (3-tier: tipology+situation > tipology-only > default)
  - MandatoryInfoResolverService (dedup by specificity, sortOrder-sorted)
  - BaseDeConhecimentoModule exported and wired into AppModule
  - LlmModelConfigSeeder with 4 default configs (classificacao/composicao/avaliacao/embeddings)
affects: [04-02-classifier, 04-03-composer, 04-04-evaluator, 05-hitl]

# Tech tracking
tech-stack:
  added:
    - ai@6.0.116 (Vercel AI SDK - embedMany, embed functions)
    - "@ai-sdk/openai@3.0.41"
    - "@ai-sdk/anthropic@3.0.58"
    - pdf-parse@2.4.5
    - "@langchain/textsplitters@1.0.1"
    - "@langchain/core"
    - "@types/pdf-parse (devDep)"
  patterns:
    - pgvector raw SQL insert with pgvector.toSql() + $N::vector cast
    - cosine similarity: ORDER BY embedding <=> $1::vector ASC; similarity = 1 - distance
    - dynamic import for pdf-parse (CJS module in ESM context)
    - batch embeddings in groups of 100 to avoid OpenAI rate limits
    - 3-tier template fallback resolution by specificity
    - specificity scoring for deduplication (tipologyId+situationId > tipologyId > global)

key-files:
  created:
    - backend/src/modules/base-de-conhecimento/entities/llm-model-config.entity.ts
    - backend/src/database/migrations/1773774007000-CreateIntelligenceLayer.ts
    - backend/src/modules/base-de-conhecimento/services/document-ingestion.service.ts
    - backend/src/modules/base-de-conhecimento/services/vector-search.service.ts
    - backend/src/modules/base-de-conhecimento/services/template-resolver.service.ts
    - backend/src/modules/base-de-conhecimento/services/mandatory-info-resolver.service.ts
    - backend/src/modules/base-de-conhecimento/base-de-conhecimento.module.ts
    - backend/src/database/seeds/llm-model-config.seeder.ts
  modified:
    - backend/src/database/seeds/main.seeder.ts (added LlmModelConfigSeeder)
    - backend/src/app.module.ts (added BaseDeConhecimentoModule + OPENAI_API_KEY env var)
    - backend/package.json (added 6 AI/PDF packages)

key-decisions:
  - "pdf-parse used via dynamic import (import()) — CJS module requires this in ESM/NestJS context"
  - "Embeddings persisted via raw DataSource.query() with pgvector.toSql() — TypeORM QueryBuilder cannot handle pgvector columns"
  - "VectorSearchService.search() filters by active document versions before similarity query — avoids stale chunk matches"
  - "LlmModelConfig seeder uses getRepository('llm_model_config') string key — entity not registered in standalone seeder context"
  - "OPENAI_API_KEY added as Joi.string().optional() — AI features optional in dev, required only in prod/staging"
  - "IVFFlat index with lists=100 — appropriate for < 1M vectors, created in migration 1773774007000"

patterns-established:
  - "pgvector insert: DataSource.query() with pgvector.toSql(arr) and $N::vector cast"
  - "cosine similarity ORDER BY ASC (<=> returns distance, not similarity)"
  - "Template fallback: tipology+situation > tipology-only > default (null tipology)"
  - "Mandatory field dedup: specificity(tipologyId) + specificity(situationId) score"

# Metrics
duration: 18min
completed: 2026-03-18
---

# Phase 4 Plan 1: Knowledge Base Foundation Summary

**RAG foundation built: DocumentIngestionService (PDF -> chunks -> text-embedding-3-small -> pgvector), VectorSearchService (cosine distance <=>), TemplateResolverService (3-tier IQI fallback), MandatoryInfoResolverService (specificity dedup), and DB-driven LlmModelConfig with 4 seeded model configs**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-18T01:09:45Z
- **Completed:** 2026-03-18T01:28:08Z
- **Tasks:** 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments
- Full PDF ingestion pipeline: pdf-parse extraction, RecursiveCharacterTextSplitter (800/100 chars), embedMany via text-embedding-3-small, raw SQL insert with pgvector.toSql()
- pgvector cosine similarity search with proper ORDER BY ASC (distance, not similarity) and similarity = 1 - distance output
- 3-tier IQI template resolution: tipology+situation exact match, tipology-only, global default
- Mandatory info rules resolution with specificity-based deduplication by fieldName
- LlmModelConfig entity enables DB-driven model selection per functionality (classificacao/composicao/avaliacao/embeddings)
- Migration 1773774007000 creates llm_model_config table and IVFFlat cosine index on kb_chunk.embedding

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create LlmModelConfig entity + migration** - `8fa9c30` (feat)
2. **Task 2: Create DocumentIngestionService and VectorSearchService** - `20ad676` (feat)
3. **Task 3: Create TemplateResolverService, MandatoryInfoResolverService, module, and seed data** - `0c01dd8` (feat)

## Files Created/Modified

- `backend/src/modules/base-de-conhecimento/entities/llm-model-config.entity.ts` - LlmModelConfig TypeORM entity with unique functionalityType, self-ref fallbackConfigId FK
- `backend/src/database/migrations/1773774007000-CreateIntelligenceLayer.ts` - Creates llm_model_config table + IVFFlat cosine index on kb_chunk.embedding
- `backend/src/modules/base-de-conhecimento/services/document-ingestion.service.ts` - PDF ingestion pipeline: extract -> chunk (800/100) -> embed (batches of 100) -> raw SQL insert
- `backend/src/modules/base-de-conhecimento/services/vector-search.service.ts` - Cosine similarity search, active version filtering, searchByVector override
- `backend/src/modules/base-de-conhecimento/services/template-resolver.service.ts` - 3-tier IQI template resolution returning ResolvedTemplate with matchType
- `backend/src/modules/base-de-conhecimento/services/mandatory-info-resolver.service.ts` - Mandatory fields with fieldName deduplication by specificity score
- `backend/src/modules/base-de-conhecimento/base-de-conhecimento.module.ts` - Module wiring MemoriaModule + RegulatorioModule, exports all 4 services + TypeOrmModule
- `backend/src/database/seeds/llm-model-config.seeder.ts` - Seeds 4 LlmModelConfig rows: classificacao/gpt-4o-mini/0.1, composicao/gpt-4o/0.7, avaliacao/gpt-4o-mini/0.2, embeddings/text-embedding-3-small/0.0
- `backend/src/database/seeds/main.seeder.ts` - Added LlmModelConfigSeeder at end of seeder chain
- `backend/src/app.module.ts` - Added BaseDeConhecimentoModule import + OPENAI_API_KEY as optional env var

## Decisions Made

- **pdf-parse via dynamic import:** `(await import('pdf-parse')).default` pattern — CJS module must be dynamically imported in NestJS TypeScript/ESM context to avoid module resolution errors
- **Raw SQL for embeddings:** DataSource.query() with pgvector.toSql() and `$N::vector` cast — TypeORM QueryBuilder/repository cannot handle pgvector vector columns
- **Active version filtering in VectorSearch:** Before running cosine query, fetch active version IDs for the requested sourceType to avoid matching stale chunks from old document versions
- **OPENAI_API_KEY optional in Joi schema:** AI features are optional in development (no API calls needed for non-AI endpoints), required only in prod/staging
- **IVFFlat lists=100:** Appropriate for < 1M vectors (research-recommended setting); HNSW would be better for higher recall but requires more memory

## Deviations from Plan

None - plan executed exactly as written.

The only minor adjustment was the seeder location: plan specified `backend/src/database/seeders/` but the project uses `backend/src/database/seeds/` (established in phase 01-03). The seeder was placed in the correct existing directory.

## Issues Encountered

- Multiple background npm install processes stacked up (3 separate install commands ran concurrently). All installed the same packages. Final node_modules state is correct with all 6 packages present.

## User Setup Required

None - no external service configuration required at this phase. OPENAI_API_KEY is needed at deployment time for AI features but is marked optional in the Joi schema.

## Next Phase Readiness

- BaseDeConhecimentoModule is fully wired and exported — ready for Phase 4.02 (AI classification), 4.03 (AI composition), 4.04 (AI evaluation)
- DocumentIngestionService is ready for KB upload endpoint (POST /api/kb/upload) — to be created in a later plan
- VectorSearchService is ready to be used in classifier and composer skill implementations
- LlmModelConfig seed data provides 4 model configs; AI services can query by functionalityType to get the right model
- Migration 1773774007000 includes IVFFlat index — will be applied at deployment time via migrationsRun: true

---
*Phase: 04-intelligence-layer*
*Completed: 2026-03-18*
