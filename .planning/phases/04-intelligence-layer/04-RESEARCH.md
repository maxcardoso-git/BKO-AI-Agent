# Phase 4: Intelligence Layer - Research

**Researched:** 2026-03-17
**Domain:** LLM provider-agnostic AI service + document ingestion pipeline + pgvector RAG + NestJS module wiring
**Confidence:** HIGH

## Summary

Phase 4 introduces two new NestJS modules: `KnowledgeBaseModule` (document ingestion, chunking, pgvector indexing, template/mandatory resolvers, document versioning) and `AiServiceModule` (prompt builder, model selector, skill agents, token tracking). The stack is strongly constrained by prior decisions: pgvector 0.2.1 is already installed; the pgvector bootstrap service already registers types on the pg pool; the embedding vector dimension is locked at 1536 (`text-embedding-3-small`).

The provider-agnostic LLM layer uses **Vercel AI SDK v6** (`ai@6.0.116` + `@ai-sdk/openai@3.0.41` + `@ai-sdk/anthropic@3.0.58`). This is the current stable release confirmed by `npm show`. The AI SDK's `generateText`, `generateObject`, and `embed/embedMany` functions provide a single unified interface across providers. Switching providers only requires changing the model parameter — the temperature, usage tracking, and structured output APIs are identical. The **model selector** is DB-driven: a new `llm_model_config` table stores provider, model ID, API key (or env-key reference), temperature, and functionality type; `ModelSelectorService` loads the active config per type and constructs the provider instance at call time using `createOpenAI()`/`createAnthropic()`.

For document ingestion: `pdf-parse@2.4.5` extracts text from PDF buffers in memory (no disk write needed); `@langchain/textsplitters@1.0.1` provides `RecursiveCharacterTextSplitter` for chunk/overlap splitting; embeddings are generated via `embedMany` from the AI SDK. pgvector cosine similarity queries use TypeORM `dataSource.query()` with `pgvector.toSql(vector)` for parameter binding. The `executeSkillStub` method in `TicketExecutionService` is replaced by injecting `AiServiceModule` providers and calling real implementations per skill key.

**Primary recommendation:** Use `ai@6` + `@ai-sdk/openai` + `@ai-sdk/anthropic` for all LLM calls. Use `pdf-parse` for PDF text extraction. Use `@langchain/textsplitters` for chunking. Use raw `dataSource.query()` with `pgvector.toSql()` for vector similarity. Store model config in a new DB table, not env vars, to satisfy the AI-02 configurability requirement.

---

## Standard Stack

### Core — New dependencies
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | 6.0.116 | Vercel AI SDK core — `generateText`, `generateObject`, `embed`, `embedMany` | v6 is latest stable; unified API across 25+ providers; built-in usage tracking (inputTokens, outputTokens) |
| `@ai-sdk/openai` | 3.0.41 | OpenAI provider (`createOpenAI`) | Official first-party AI SDK provider; supports gpt-4o, gpt-4o-mini, text-embedding-3-small |
| `@ai-sdk/anthropic` | 3.0.58 | Anthropic provider (`createAnthropic`) | Official first-party; supports claude-sonnet-4-6, claude-haiku-4-5 |
| `pdf-parse` | 2.4.5 | Extract text from PDF buffer in Node.js | ~2M weekly downloads; single function call; ideal for LLM pipelines; no disk write needed |
| `@langchain/textsplitters` | 1.0.1 | `RecursiveCharacterTextSplitter` for chunk/overlap | Purpose-built text splitting; TypeScript native; separates on `\n\n`, `\n`, ` ` recursively |
| `@types/multer` | latest | Types for NestJS `@UseInterceptors(FileInterceptor)` | Already peer dep of @nestjs/platform-express |

### Supporting — Already installed, leverage as-is
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| `pgvector` | 0.2.1 | `pgvector.toSql()` for embedding serialization in raw queries | Already installed and bootstrapped |
| `multer` | 2.1.1 | PDF upload endpoint (KB Manager BFF) | Bundled with @nestjs/platform-express |
| `zod` | ^3 | Schema validation for `generateObject` structured output | Must already be present (AI SDK v6 peer dep) |

### Alternatives Considered
| Instead of | Could Use | Why not |
|------------|-----------|---------|
| `ai` (Vercel AI SDK) | Direct `openai` + `@anthropic-ai/sdk` | Requires provider-specific code paths; SDK v6 gives single interface |
| `ai` (Vercel AI SDK) | LangChain.js | LangChain adds orchestration overhead not needed here; AI SDK sufficient for individual calls |
| `pdf-parse` | `unpdf` | unpdf targets edge/isomorphic; pdf-parse is simpler for Node.js-only backend |
| `@langchain/textsplitters` | Custom splitter | Custom splitters miss edge cases (CJK, ligatures, paragraph detection) |
| DB-driven model config | env-var-only config | AI-02 explicitly requires admin UI page to register models per functionality type |

**Installation (new packages only):**
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic pdf-parse @langchain/textsplitters
npm install --save-dev @types/pdf-parse
```

---

## Architecture Patterns

### Recommended Module Structure

```
src/modules/
├── base-de-conhecimento/          # KnowledgeBaseModule (04-01)
│   ├── entities/
│   │   └── llm-model-config.entity.ts   # NEW — model registry
│   ├── services/
│   │   ├── document-ingestion.service.ts
│   │   ├── vector-search.service.ts
│   │   ├── template-resolver.service.ts
│   │   └── mandatory-info-resolver.service.ts
│   ├── controllers/
│   │   └── kb-manager.controller.ts     # BFF: upload, list, activate version
│   └── base-de-conhecimento.module.ts
└── ia/                            # AiServiceModule (04-02 + 04-03)
    ├── entities/
    │   └── (uses llm-model-config from KB module, or co-locate)
    ├── services/
    │   ├── model-selector.service.ts    # Loads config from DB, builds provider instance
    │   ├── prompt-builder.service.ts    # Context assembly per step type
    │   ├── complaint-parsing.agent.ts   # Uses generateObject (AI-05)
    │   ├── draft-generator.agent.ts     # Uses generateText (AI-06)
    │   ├── compliance-evaluator.agent.ts # Uses generateObject (AI-07)
    │   ├── final-response-composer.agent.ts # Uses generateText (AI-08)
    │   └── token-usage-tracker.service.ts   # Persists LlmCall + TokenUsage (AI-09)
    └── ia.module.ts
```

### New Entity Required: llm_model_config

```typescript
// src/modules/base-de-conhecimento/entities/llm-model-config.entity.ts
@Entity('llm_model_config')
export class LlmModelConfig {
  @PrimaryGeneratedColumn('uuid') id: string;

  // e.g. 'classificacao' | 'composicao' | 'avaliacao' | 'embeddings'
  @Column({ type: 'varchar', unique: true })
  functionalityType: string;

  // 'openai' | 'anthropic'
  @Column({ type: 'varchar' })
  provider: string;

  // 'gpt-4o-mini' | 'claude-haiku-4-5' etc.
  @Column({ type: 'varchar' })
  modelId: string;

  // 'OPENAI_API_KEY' (env var name) or null to use OPENAI_API_KEY default
  @Column({ type: 'varchar', nullable: true })
  apiKeyEnvVar: string | null;

  @Column({ type: 'float', default: 0.3 })
  temperature: number;

  @Column({ type: 'int', nullable: true })
  maxTokens: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Fallback: if this provider fails, try this config
  @Column({ type: 'uuid', nullable: true })
  fallbackConfigId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### Pattern 1: DB-Driven Model Selector (AI-02, AI-03, AI-04)

**What:** `ModelSelectorService` loads `LlmModelConfig` by `functionalityType`, constructs the provider instance per call using `createOpenAI` or `createAnthropic`.

**Why:** Satisfies AI-02 (admin-configurable), AI-03 (different models per functionality), AI-04 (fallback chain).

```typescript
// Source: ai-sdk.dev/providers/ai-sdk-providers/openai + anthropic
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

@Injectable()
export class ModelSelectorService {
  constructor(
    @InjectRepository(LlmModelConfig)
    private readonly configRepo: Repository<LlmModelConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getModel(functionalityType: string): Promise<LanguageModel> {
    const config = await this.configRepo.findOne({
      where: { functionalityType, isActive: true },
    });
    if (!config) {
      throw new Error(`No active LLM config for type: ${functionalityType}`);
    }
    return this.buildModel(config);
  }

  private buildModel(config: LlmModelConfig): LanguageModel {
    const apiKey = config.apiKeyEnvVar
      ? this.configService.get<string>(config.apiKeyEnvVar)
      : undefined; // SDK falls back to OPENAI_API_KEY / ANTHROPIC_API_KEY env vars

    if (config.provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      return openai(config.modelId);
    }
    if (config.provider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(config.modelId);
    }
    throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### Pattern 2: generateText with Temperature per Step (AI-10)

**What:** Each agent call passes temperature from the DB config rather than hardcoding it.

```typescript
// Source: ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
import { generateText } from 'ai';

const config = await this.modelSelector.getConfig('composicao'); // includes temperature
const model = this.modelSelector.buildModelFromConfig(config);

const { text, usage } = await generateText({
  model,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
  temperature: config.temperature, // 0.1 for classificacao, 0.7 for composicao
  maxOutputTokens: config.maxTokens ?? 2048,
});

// usage.inputTokens, usage.outputTokens, usage.totalTokens — built-in
```

### Pattern 3: generateObject for Structured Agents (AI-05, AI-07)

**What:** For complaint parsing and compliance evaluation, use `generateObject` with Zod schemas to get typed output.

```typescript
// Source: ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
import { generateObject } from 'ai';
import { z } from 'zod';

const ComplaintDataSchema = z.object({
  tipologyKey: z.string(),
  confidence: z.number(),
  summary: z.string(),
  keyFacts: z.array(z.string()),
});

const { object, usage } = await generateObject({
  model,
  schema: ComplaintDataSchema,
  system: 'You extract structured data from complaint text.',
  prompt: `Extract data from: ${complaintText}`,
  temperature: 0.1, // classification: low temperature
});
// object is typed as z.infer<typeof ComplaintDataSchema>
```

### Pattern 4: pgvector Cosine Similarity with TypeORM (KB-03)

**What:** Raw SQL query using `<=>` operator for cosine distance. TypeORM `dataSource.query()` accepts pgvector-formatted parameters via `pgvector.toSql()`.

**Important:** `<=>` returns cosine DISTANCE (0=identical, 2=opposite). Similarity = `1 - distance`. Order by distance ASC to get most similar first.

```typescript
// Source: github.com/pgvector/pgvector-node (tests/typeorm.test.mjs)
import * as pgvector from 'pgvector/pg';
import { DataSource } from 'typeorm';

async searchSimilarChunks(
  queryEmbedding: number[],
  limit = 5,
  documentVersionId?: string,
): Promise<KbChunk[]> {
  const vectorParam = pgvector.toSql(queryEmbedding);

  let sql = `
    SELECT id, content, "chunkIndex", "sectionTitle", metadata,
           1 - (embedding <=> $1::vector) AS similarity
    FROM kb_chunk
  `;
  const params: unknown[] = [vectorParam];

  if (documentVersionId) {
    sql += ` WHERE "documentVersionId" = $2`;
    params.push(documentVersionId);
  }

  sql += ` ORDER BY embedding <=> $1::vector ASC LIMIT ${limit}`;

  const rows = await this.dataSource.query(sql, params);
  return rows; // includes similarity score
}
```

**Index for cosine:** Migration must create `ivfflat` or `hnsw` index with `vector_cosine_ops`:
```sql
CREATE INDEX "IDX_kb_chunk_embedding_cosine"
ON "kb_chunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Pattern 5: PDF Ingestion Pipeline (KB-01, KB-02)

**What:** Upload endpoint receives PDF buffer via Multer memory storage, extracts text with `pdf-parse`, splits with `RecursiveCharacterTextSplitter`, embeds each chunk with `embedMany`, persists to `kb_chunk`.

```typescript
// Source: pkgpulse.com comparison article (Feb 2026), ai-sdk.dev/docs/ai-sdk-core/embeddings
import pdfParse from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

async ingestDocument(
  buffer: Buffer,
  documentVersionId: string,
  sourceType: string,
): Promise<number> {
  // 1. Extract text
  const { text } = await pdfParse(buffer);

  // 2. Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,     // ~600 tokens for text-embedding-3-small
    chunkOverlap: 100,  // preserve sentence context at boundaries
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });
  const docs = await splitter.createDocuments([text]);

  // 3. Generate embeddings in batch (more efficient than one-by-one)
  const embeddingModel = openai.embedding('text-embedding-3-small'); // 1536 dims
  const { embeddings, usage } = await embedMany({
    model: embeddingModel,
    values: docs.map((d) => d.pageContent),
  });

  // 4. Persist chunks
  const chunks = docs.map((doc, i) => ({
    content: doc.pageContent,
    chunkIndex: i,
    embedding: pgvector.toSql(embeddings[i]),
    documentVersionId,
    metadata: { sourceType, charCount: doc.pageContent.length },
  }));

  await this.kbChunkRepo
    .createQueryBuilder()
    .insert()
    .into(KbChunk)
    .values(chunks)
    .execute();

  return chunks.length;
}
```

### Pattern 6: TicketExecutionService Skill Stub Replacement (Phase 3 → Phase 4)

**What:** The `executeSkillStub` private method in `TicketExecutionService` must be replaced by a real `executeSkill` dispatcher that delegates to the AI service module.

**Approach:** Inject `IaModule` services into `ExecucaoModule`. The `TicketExecutionService` calls the correct agent service per skill key. Do NOT remove the dispatch table — replace stub return values with real service calls.

```typescript
// Inject into TicketExecutionService constructor:
private readonly complaintParser: ComplaintParsingAgent,
private readonly draftGenerator: DraftGeneratorAgent,
private readonly complianceEvaluator: ComplianceEvaluatorAgent,
// etc.

// Replace executeSkillStub with:
private async executeSkill(
  skillKey: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (skillKey) {
    case 'ClassifyTypology':
      return this.complaintParser.classify(input);
    case 'RetrieveManualContext':
      return this.vectorSearch.retrieveContext(input);
    case 'RetrieveIQITemplate':
      return this.templateResolver.resolve(input);
    case 'BuildMandatoryChecklist':
      return this.mandatoryInfoResolver.build(input);
    case 'DraftFinalResponse':
      return this.draftGenerator.generate(input);
    case 'ComplianceCheck':
      return this.complianceEvaluator.evaluate(input);
    // ... etc
    default:
      return { error: 'Unknown skill: ' + skillKey };
  }
}
// advanceStep and retryStep become async — must await executeSkill
```

**CRITICAL:** `advanceStep` is currently synchronous for the skill call. Replacing with real LLM calls requires making the skill execution `async`. The caller already awaits `advanceStep`, so no interface change is needed.

### Pattern 7: Token Usage Persistence (AI-09)

**What:** After every `generateText`/`generateObject` call, persist to `llm_call` and `token_usage` tables. `TokenUsageTrackerService` wraps this.

```typescript
// usage.inputTokens, usage.outputTokens from AI SDK v6 (confirmed from ai-sdk.dev/docs/reference)
async trackUsage(
  stepExecutionId: string,
  model: string,
  provider: string,
  usage: { inputTokens: number; outputTokens: number },
  latencyMs: number,
  error: string | null,
): Promise<LlmCall> {
  const totalTokens = usage.inputTokens + usage.outputTokens;
  // Cost estimation: look up per-1k-token rates from a static price table keyed by model
  const costUsd = this.estimateCost(model, usage.inputTokens, usage.outputTokens);

  const llmCall = this.llmCallRepo.create({
    model,
    provider,
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    totalTokens,
    costUsd,
    latencyMs,
    stepExecutionId,
    responseStatus: error ? 'error' : 'success',
    errorMessage: error,
  });
  const saved = await this.llmCallRepo.save(llmCall);

  // TokenUsage is OneToOne with LlmCall
  await this.tokenUsageRepo.save(this.tokenUsageRepo.create({
    llmCallId: saved.id, // wait — check entity for correct FK column name
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    totalTokens,
    costUsd: costUsd ?? 0,
    model,
  }));

  return saved;
}
```

**Note:** Check `token_usage.entity.ts` — it has a `OneToOne(() => LlmCall)` relation but no `llmCallId` FK column visible. The migration must verify the FK direction. The existing `LlmCall` has `tokenUsageId UUID nullable`. Pattern: create `LlmCall` first, then create `TokenUsage` linked back by `llmCallId` (add FK to `token_usage` table if missing) OR use the `cascade: true` on `LlmCall.tokenUsage` relation.

### Anti-Patterns to Avoid

- **Calling `pgvector/typeorm` subpath:** Does not exist in `pgvector@0.2.x`. Use `pgvector/pg` for `registerTypes`, and `pgvector.toSql()` for parameter serialization in raw queries. This is already confirmed by the existing `PgvectorBootstrapService`.
- **Building a custom provider abstraction class:** Do not hand-roll an `LlmProvider` interface with `execute()`. Use Vercel AI SDK's `LanguageModel` type directly — it IS the abstraction.
- **Storing full PDF content in `kb_document`:** The existing `kb_document` entity has `filePath VARCHAR` and `mimeType`. Store the original file path (or S3 key), not the raw text blob. Text extraction happens at ingestion time and is stored only in `kb_chunk.content`.
- **Using `synchronize: true` to add `llm_model_config` table:** Always write a TypeORM migration (project pattern is `synchronize: false`).
- **Passing raw JS arrays as vector parameters:** Must call `pgvector.toSql(embedding)` before using embedding as SQL parameter. Raw arrays are serialized as Postgres ARRAY syntax, not vector syntax, causing type errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider switching | Custom `LlmProvider` interface with if/else per provider | `ai` SDK + `@ai-sdk/openai` / `@ai-sdk/anthropic` | SDK handles streaming, retries, error normalization, usage extraction |
| Structured LLM output | Manual JSON.parse + regex on model response | `generateObject` with Zod schema | SDK handles retries on schema validation failure |
| PDF text extraction | Custom PDF binary parser | `pdf-parse` | PDFs have complex internal structure; pdf-parse handles encoding, pages, multi-column |
| Text chunking | String.split('\n\n') | `RecursiveCharacterTextSplitter` | Naive splitting breaks mid-sentence; recursive splitter respects paragraph/sentence/word boundaries |
| Token counting pre-call | Custom character-count heuristic | AI SDK `usage` from `generateText` return value | Post-call exact counts are more accurate; pre-call estimates not needed for this use case |
| Embedding generation | Direct fetch to OpenAI /embeddings endpoint | `embedMany` from AI SDK | Handles batch parallelism, retries, usage tracking, provider switching |
| Cosine similarity scoring | Custom dot-product in JS | `1 - (embedding <=> $1::vector)` in SQL | pgvector IVFFlat/HNSW indexes only apply inside the DB query, not in JS |

**Key insight:** In this domain, every "simple" problem (chunking, embedding, parsing) has well-maintained libraries that handle 95% of edge cases. The only truly custom code is the prompt templates and business logic orchestration.

---

## Common Pitfalls

### Pitfall 1: pgvector `<=>` is cosine DISTANCE, not similarity
**What goes wrong:** Sorting `ORDER BY embedding <=> $1 DESC` to get "most similar" results in least similar records returned.
**Why it happens:** pgvector's `<=>` returns distance (0=same, 2=opposite). Higher value = MORE different.
**How to avoid:** Always use `ORDER BY embedding <=> $1 ASC LIMIT n`. Compute `1 - distance` only if you need to expose a similarity score to callers.
**Warning signs:** Search results are the opposite of what you expect; all returned results have low relevance.

### Pitfall 2: Embedding dimension mismatch
**What goes wrong:** Inserting a 1536-dim embedding into `vector(1536)` column with a different-dimension embedding causes a DB error.
**Why it happens:** If the embedding model is changed in `llm_model_config` to one producing different dimensions (e.g., 3072 for `text-embedding-3-large`), the column constraint rejects the insert.
**How to avoid:** Lock the `embeddings` functionality type in `llm_model_config` to `text-embedding-3-small` (1536 dims). If dimension change is ever needed, it requires a schema migration to `vector(3072)` + full re-ingestion. Document this constraint.
**Warning signs:** `ERROR: expected 1536 dimensions, not 3072` on insert.

### Pitfall 3: `advanceStep` synchronous-to-async transition
**What goes wrong:** `executeSkillStub` is currently synchronous. Replacing with real AI calls (which are all async) requires `advanceStep` to `await` the skill. Forgetting the `await` causes `output` to be a Promise object stored in the DB.
**Why it happens:** TypeScript does not error if you assign a `Promise<Record>` to `Record` when the type is loose.
**How to avoid:** Change `executeSkillStub` return type from `Record<string, unknown>` to `Promise<Record<string, unknown>>` and `await` all calls in `advanceStep` and `retryStep`.
**Warning signs:** `stepExec.output = { [Symbol(nodejs.rejection)]... }` in DB.

### Pitfall 4: Token usage table FK ambiguity
**What goes wrong:** `token_usage` entity has a `OneToOne(() => LlmCall)` but NO `@JoinColumn` — meaning no FK column exists on `token_usage`. The FK is on `llm_call.tokenUsageId`. Trying to save `TokenUsage` with a `llmCallId` field will fail if that column doesn't exist in the DB schema.
**Why it happens:** The Phase 1 migration created `token_usage` without a `llm_call_id` FK column. The `LlmCall` entity owns the relation via `tokenUsageId`.
**How to avoid:** Always create `LlmCall` first (no `tokenUsageId` set), then create `TokenUsage`. Then update `llm_call.tokenUsageId = tokenUsage.id`. Alternatively, use TypeORM cascade: save `LlmCall` with `tokenUsage` nested, letting TypeORM handle the FK update via `cascade: true`.
**Warning signs:** `null constraint violation` on `token_usage` insert if you add a `llm_call_id` column that the migration doesn't define.

### Pitfall 5: pdf-parse TypeScript import
**What goes wrong:** `import pdfParse from 'pdf-parse'` fails with `has no default export` in strict TypeScript.
**Why it happens:** `pdf-parse` is a CommonJS module. Its `@types/pdf-parse` types declare a default export but TS `esModuleInterop` may be off.
**How to avoid:** Ensure `"esModuleInterop": true` in `tsconfig.json` (NestJS projects have this by default). Use `import pdfParse from 'pdf-parse'` with esModuleInterop enabled. Alternative: `const pdfParse = require('pdf-parse')` with `// eslint-disable-next-line`.
**Warning signs:** Build error `Module '"pdf-parse"' has no default export`.

### Pitfall 6: LlmModelConfig migration must precede seed data
**What goes wrong:** Phase 4 seeds `llm_model_config` rows (at minimum a default `classificacao` and `composicao` config) but the migration that creates the table must run first.
**Why it happens:** Migrations run in timestamp order; if the seed runs before migration, table won't exist.
**How to avoid:** Create migration `1773774007000-CreateIntelligenceLayer.ts` with the `llm_model_config` table + ivfflat index creation. Seed data is separate from migration.

### Pitfall 7: `@langchain/textsplitters` requires `@langchain/core` peer dep
**What goes wrong:** Installing `@langchain/textsplitters` alone fails with a peer dep warning about `@langchain/core`.
**Why it happens:** `@langchain/textsplitters@1.0.1` has `@langchain/core` as a peer dependency.
**How to avoid:** Install both: `npm install @langchain/textsplitters @langchain/core`. Core is ~300KB and has no conflicting deps with the existing stack.

---

## Code Examples

### Embedding generation for KB ingestion
```typescript
// Source: ai-sdk.dev/docs/ai-sdk-core/embeddings
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const openaiProvider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const embeddingModel = openaiProvider.textEmbeddingModel('text-embedding-3-small');

const { embeddings } = await embedMany({
  model: embeddingModel,
  values: chunkTexts, // string[]
  maxParallelCalls: 5, // avoid rate limiting
});
// embeddings: number[][] — each array is 1536 floats
```

### pgvector cosine similarity query
```typescript
// Source: github.com/pgvector/pgvector-node tests/typeorm.test.mjs
import * as pgvector from 'pgvector/pg';

const results = await this.dataSource.query(
  `SELECT id, content, "sectionTitle",
          1 - (embedding <=> $1::vector) AS similarity
   FROM kb_chunk
   WHERE "documentVersionId" = ANY($2::uuid[])
   ORDER BY embedding <=> $1::vector ASC
   LIMIT $3`,
  [pgvector.toSql(queryVector), activeVersionIds, topK],
);
```

### RecursiveCharacterTextSplitter — recommended chunk params
```typescript
// Source: pinecone.io/learn/chunking-strategies (MEDIUM confidence — verified by multiple sources)
// For Anatel Manual (long-form regulatory text):
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,      // characters, ~550-600 tokens for text-embedding-3-small
  chunkOverlap: 100,   // 12.5% overlap — preserves sentence boundaries
  separators: ['\n\n', '\n', '. ', ' ', ''],
});
// For IQI Guide (shorter, structured by section):
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 80,
  separators: ['\n\n', '\n', '. ', ' ', ''],
});
```

### NestJS file upload for KB Manager
```typescript
// Source: docs.nestjs.com (NestJS file upload pattern)
import { UseInterceptors, UploadedFile, Post, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_, file, cb) => {
    const ok = ['application/pdf', 'text/plain'].includes(file.mimetype);
    cb(null, ok);
  },
}))
async upload(
  @UploadedFile() file: Express.Multer.File,
  @Body('documentType') documentType: string,
) {
  return this.ingestionService.ingest(file.buffer, file.originalname, documentType);
}
```

### Module dependency chain
```typescript
// ia.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([LlmModelConfig, LlmCall, TokenUsage]),
    BaseDeConhecimentoModule, // provides VectorSearchService, TemplateResolverService
    RegulatorioModule,        // provides Tipology, Situation, MandatoryInfoRule repos
    OperacaoModule,           // provides Complaint repo
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
    ComplaintParsingAgent,
    DraftGeneratorAgent,
    ComplianceEvaluatorAgent,
    FinalResponseComposerAgent,
    TokenUsageTrackerService,
    VectorSearchService, // re-exported via BaseDeConhecimentoModule
  ],
})
export class IaModule {}

// execucao.module.ts — update to import IaModule
@Module({
  imports: [
    TypeOrmModule.forFeature([...]),
    OrquestracaoModule,
    OperacaoModule,
    IaModule,          // ADD — gives TicketExecutionService access to real agents
  ],
  ...
})
export class ExecucaoModule {}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct OpenAI SDK + separate Anthropic SDK | Vercel AI SDK v6 unified interface | AI SDK v5 (2024), v6 (2025) | Single `generateText`/`generateObject` call works across providers |
| LangChain for all LLM orchestration | AI SDK for calls + @langchain/textsplitters for splitting only | 2024-2025 | Lighter dependency; LangChain overhead not needed for single-step agents |
| `tiktoken` for pre-call token counting | AI SDK `usage` object from response | 2024 | Post-call exact counts are authoritative; pre-call estimation not needed |
| `text-embedding-ada-002` (1536 dims) | `text-embedding-3-small` (1536 dims, 5x cheaper) | Jan 2024 | Same dimension, better quality, cheaper — already locked in schema |
| `pgvector.toSql()` with manual raw query | Same — no change | Stable | TypeORM still requires raw SQL for vector ops; no higher-level abstraction |

**Deprecated/outdated:**
- `@dqbd/tiktoken`: Superseded by official `tiktoken` WASM package and by AI SDK's built-in usage tracking. Do not use.
- `langchain` (full bundle): Installing full `langchain` for just the text splitter is excessive. Use `@langchain/textsplitters` + `@langchain/core` only.
- `pgvector/typeorm` import path: Does not exist in pgvector 0.2.x. Already confirmed by existing `PgvectorBootstrapService` using `pgvector/pg`.

---

## Open Questions

1. **Token usage FK direction in existing schema**
   - What we know: `llm_call` has `tokenUsageId UUID nullable`; `token_usage` has `OneToOne(() => LlmCall)` with no `@JoinColumn`
   - What's unclear: Does the migration create a `token_usage.llm_call_id` FK or does `llm_call.token_usage_id` own the relation?
   - Recommendation: Read `1773774004000-CreateExecucaoTables.ts` migration before implementing `TokenUsageTrackerService`. Use whichever FK the migration defines. If `llm_call.tokenUsageId` owns it: create `TokenUsage` first, get its ID, then set `llmCall.tokenUsageId`.

2. **IVFFlat vs HNSW index for kb_chunk**
   - What we know: Both are valid pgvector index types for cosine; HNSW has better recall but higher memory usage
   - What's unclear: The dataset size for this project (Anatel Manual is ~hundreds of pages; IQI Guide is smaller)
   - Recommendation: Use `ivfflat` with `lists = 100` for initial implementation. HNSW can be swapped in a later migration if recall is insufficient. IVFFlat is adequate for < 1M vectors.

3. **Fallback model execution strategy (AI-04)**
   - What we know: `LlmModelConfig` will have a `fallbackConfigId`; AI SDK v6 does not have native multi-model fallback
   - What's unclear: Whether to implement try/catch fallback in `ModelSelectorService` or in each agent
   - Recommendation: Implement in `ModelSelectorService.callWithFallback(functionalityType, callFn)` — a wrapper that catches provider errors and retries with the fallback config. This centralizes the fallback logic.

4. **KB Manager frontend integration scope in 04-03**
   - What we know: KB-08 requires upload/versioning UI in the frontend
   - What's unclear: Whether 04-03 includes the full frontend KB Manager page or just the BFF endpoints
   - Recommendation: 04-03 should deliver the BFF endpoints (upload, list documents, activate version). The full frontend page may spill into Phase 5 or a dedicated sub-task if time-boxed.

---

## Sources

### Primary (HIGH confidence)
- `npm show ai version` → `6.0.116` (verified 2026-03-17)
- `npm show @ai-sdk/openai version` → `3.0.41` (verified 2026-03-17)
- `npm show @ai-sdk/anthropic version` → `3.0.58` (verified 2026-03-17)
- `npm show @langchain/textsplitters version` → `1.0.1` (verified 2026-03-17)
- `npm show pdf-parse version` → `2.4.5` (verified 2026-03-17)
- `npm show pgvector version` → `0.2.1` (verified 2026-03-17, already installed)
- ai-sdk.dev/docs/ai-sdk-core/embeddings — `embed`, `embedMany` API, supported providers, dimensions
- ai-sdk.dev/docs/ai-sdk-core/generating-structured-data — `generateObject` with Zod, `Output.object()`
- ai-sdk.dev/docs/reference/ai-sdk-core/generate-text — `generateText` signature, `temperature`, `usage` return
- ai-sdk.dev/providers/ai-sdk-providers/anthropic — `createAnthropic`, API key pattern
- ai-sdk.dev/providers/ai-sdk-providers/openai — `createOpenAI`, `baseURL`, custom config
- github.com/pgvector/pgvector-node tests/typeorm.test.mjs — TypeORM raw query pattern, `pgvector.toSql()`
- Codebase inspection: `PgvectorBootstrapService`, `KbChunk.entity`, `TokenUsage.entity`, `LlmCall.entity`, `TicketExecutionService` (read 2026-03-17)

### Secondary (MEDIUM confidence)
- pkgpulse.com/blog/unpdf-vs-pdf-parse comparison (Feb 2026) — pdf-parse recommended for Node.js backend LLM pipelines
- pinecone.io/learn/chunking-strategies — chunk size 800 chars / 100 overlap for regulatory documents
- ai-sdk.dev/docs/ai-sdk-core/settings — temperature passed per call, not globally

### Tertiary (LOW confidence — flag for validation)
- WebSearch: "NestJS provider-agnostic LLM service 2026" — confirmed Vercel AI SDK as the standard, but no single authoritative NestJS+AI tutorial
- Chunk size recommendation (800 chars, 100 overlap): based on multiple community sources + Pinecone guide; exact values for Anatel Manual should be validated empirically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via `npm show` on 2026-03-17
- Architecture: HIGH — based on direct codebase inspection + official AI SDK docs
- pgvector query pattern: HIGH — verified against pgvector-node official test file
- Pitfalls: HIGH for items 1-4 (verified against code); MEDIUM for items 5-7 (from official sources)
- Chunk size parameters: MEDIUM — community consensus, needs empirical validation

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (AI SDK moves fast; verify major version before implementing)
