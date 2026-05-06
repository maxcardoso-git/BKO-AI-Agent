# Phase 5: Skills Pipeline - Research

**Researched:** 2026-03-17
**Domain:** NestJS skill dispatcher architecture, artifact persistence, memory persistence, persona tone application, validation logic
**Confidence:** HIGH — all findings derived from direct codebase inspection

---

## Summary

Phase 5 implements the 13 remaining stub skills in `TicketExecutionService.executeSkill()`. Six skills already have real implementations (ClassifyTypology, RetrieveManualContext, RetrieveIQITemplate, BuildMandatoryChecklist, DraftFinalResponse, ComplianceCheck, GenerateArtifact). The stubs for LoadComplaint, NormalizeComplaintText, ComputeSla, DetermineRegulatoryAction, ApplyPersonaTone, HumanDiffCapture, PersistMemory, TrackTokenUsage, AuditTrail, and the three Validate* skills need to be replaced with real logic.

The primary architectural decision to make is whether to extract skills into a `SkillRegistryService` or continue as a large switch statement in `TicketExecutionService`. Given that skills need access to 10+ injected services already wired into `TicketExecutionService`, a dedicated `SkillRegistryService` should receive those services through NestJS DI and be called from `TicketExecutionService.executeSkill()`. Each skill that produces an artifact must call `this.artifactRepo.save()` with `complaintId` (from execution context) and `stepExecutionId`. The `PersistMemory` skill requires access to `CaseMemory` and `HumanFeedbackMemory` repositories, which means `MemoriaModule` must export those repositories to `ExecucaoModule` (currently `MemoriaModule` exports only `TypeOrmModule` — the repos are accessible via that, but `ExecucaoModule` does not import `MemoriaModule`).

The ART-11 artifact type (HumanDiffCapture) is intentionally out of scope for this phase; the skill should produce a placeholder artifact with `{ diffSummary: 'pending_human_review', changesCount: null }` and the real diff gets populated in Phase 6 when the human reviews and approves.

**Primary recommendation:** Keep all skill logic inside a single `SkillRegistryService` (new injectable), inject it into `TicketExecutionService`, add `MemoriaModule` as an import in `ExecucaoModule`, and add `Persona` repo access via `RegulatorioModule` (already transitively available).

---

## Standard Stack

### Core (already in use — HIGH confidence from direct inspection)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS TypeORM | as wired | Repository injection pattern | Already used throughout |
| `typeorm` Repository | as wired | `save()`, `create()` for artifact/memory persistence | Direct DB access |
| `@nestjs/common` Injectable | as wired | DI for SkillRegistryService | NestJS pattern |
| `pgvector` | as wired | Embedding persistence for CaseMemory / HumanFeedbackMemory | Required for vector column |
| Vercel AI SDK (`ai`) | as wired | `generateObject` / `generateText` for DetermineRegulatoryAction | Phase 4 pattern established |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | as wired | Schema validation for DetermineRegulatoryAction structured output | Same pattern as ClassifyTypology |
| OpenAI embeddings | as wired via ModelSelectorService | Generate 1536-dim embeddings for CaseMemory/HumanFeedbackMemory insertion | Required for vector column |

### No New Installations Needed

All required libraries are already installed. Phase 5 requires no `npm install`.

---

## Architecture Patterns

### Recommended Module Structure

```
src/modules/execucao/
├── services/
│   ├── ticket-execution.service.ts     # Existing — calls SkillRegistryService
│   ├── execution.service.ts            # Existing — unchanged
│   └── skill-registry.service.ts       # NEW — contains all 19 skill implementations
```

The `SkillRegistryService` receives all required service dependencies via NestJS constructor injection and exposes a single `execute(skillKey, input, stepExecutionId, context): Promise<Record<string, unknown>>` method. `TicketExecutionService.executeSkill()` delegates entirely to it.

### Pattern 1: SkillRegistryService — Single Dispatcher

**What:** One injectable service that owns all skill implementations. `TicketExecutionService` delegates the switch statement to it.
**When to use:** Always — this is the only supported pattern for Phase 5.

```typescript
// Source: codebase — ticket-execution.service.ts executeSkill() pattern
@Injectable()
export class SkillRegistryService {
  constructor(
    @InjectRepository(Artifact) private readonly artifactRepo: Repository<Artifact>,
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(CaseMemory) private readonly caseMemoryRepo: Repository<CaseMemory>,
    @InjectRepository(HumanFeedbackMemory) private readonly humanFeedbackRepo: Repository<HumanFeedbackMemory>,
    @InjectRepository(Persona) private readonly personaRepo: Repository<Persona>,
    @InjectRepository(Complaint) private readonly complaintRepo: Repository<Complaint>,
    private readonly orchService: RegulatoryOrchestrationService,
    private readonly complaintParser: ComplaintParsingAgent,
    private readonly draftGenerator: DraftGeneratorAgent,
    private readonly complianceEvaluator: ComplianceEvaluatorAgent,
    private readonly finalResponseComposer: FinalResponseComposerAgent,
    private readonly tokenUsageTracker: TokenUsageTrackerService,
    private readonly vectorSearch: VectorSearchService,
    private readonly templateResolver: TemplateResolverService,
    private readonly mandatoryInfoResolver: MandatoryInfoResolverService,
    private readonly modelSelector: ModelSelectorService,
  ) {}

  async execute(
    skillKey: string,
    input: Record<string, unknown>,
    stepExecutionId: string,
    complaintId: string,
  ): Promise<Record<string, unknown>> { ... }
}
```

### Pattern 2: Artifact Persistence (one call per artifact-producing skill)

**What:** Each skill that produces a typed artifact calls `artifactRepo.save()` before returning.
**When to use:** All 8 artifact-producing skills listed in the artifact map below.

```typescript
// Source: codebase — artifact.entity.ts + migration 1773774004000
const artifact = await this.artifactRepo.save(
  this.artifactRepo.create({
    artifactType: 'parsed_complaint',   // one of the 11 enum values below
    content: { /* skill output */ },
    version: 1,
    stepExecutionId,
    complaintId,
  }),
);
return { ...result, artifactId: artifact.id };
```

### Pattern 3: Memory Persistence with Embeddings

**What:** PersistMemory skill creates a `CaseMemory` row with a pgvector embedding.
**When to use:** PersistMemory skill only.

The `CaseMemory.embedding` column is `vector(1536)` (NOT NULL). Inserting without an embedding will violate the DB constraint. Use `ModelSelectorService.getEmbeddingModel()` to generate the embedding from the case summary text, then use `pgvector.toSql()` to format before raw insert OR pass the embedding as a plain number array — TypeORM with pgvector accepts `number[]` in the entity column.

```typescript
// Source: codebase — vector-search.service.ts embed() pattern + case-memory.entity.ts
import { embed } from 'ai';
import * as pgvector from 'pgvector/pg';

const embeddingModel = await this.modelSelector.getEmbeddingModel();
const { embedding } = await embed({ model: embeddingModel, value: summaryText });

// CaseMemory embedding column type is 'vector' — must be stored as pgvector-compatible
const caseMemory = await this.caseMemoryRepo.save(
  this.caseMemoryRepo.create({
    summary: summaryText,
    decision: outcome?.decision ?? null,
    outcome: outcome?.actionKey ?? null,
    responseSnippet: outcome?.finalResponse?.slice(0, 500) ?? null,
    embedding: pgvector.toSql(embedding) as unknown as string,
    complaintId,
    tipologyId: outcome?.tipologyId ?? null,
  }),
);
```

### Pattern 4: ApplyPersonaTone — Rule-Based Text Adjustment

**What:** Load `Persona` by tipologyId, apply formalityLevel/empathyLevel/assertivenessLevel rules, enforce requiredExpressions, strip forbiddenExpressions. No LLM call needed — rule-based string manipulation.
**When to use:** ApplyPersonaTone skill only.

```typescript
// Source: codebase — persona.entity.ts fields
const persona = await this.personaRepo.findOne({
  where: { tipologyId: input['tipologyId'] as string, isActive: true },
});
// If no persona found, return draftText unchanged
if (!persona) return { adjustedText: draftText, personaApplied: false };

// Apply forbidden expressions (case-insensitive replace)
let adjustedText = draftText;
for (const expr of persona.forbiddenExpressions ?? []) {
  adjustedText = adjustedText.replace(new RegExp(expr, 'gi'), '');
}

// Ensure required expressions are present (append to end if not found)
for (const expr of persona.requiredExpressions ?? []) {
  if (!adjustedText.toLowerCase().includes(expr.toLowerCase())) {
    adjustedText += `\n${expr}`;
  }
}

return {
  adjustedText,
  personaApplied: true,
  personaId: persona.id,
  formalityLevel: persona.formalityLevel,
};
```

### Pattern 5: DetermineRegulatoryAction with generateObject

**What:** Use `generateObject` with Zod schema to classify action (responder/reclassificar/reencaminhar/cancelar), then track token usage.
**When to use:** DetermineRegulatoryAction skill only.

The skill also needs to load the `RegulatoryAction` entities to validate the returned `actionKey` against seeded actions. The `RegulatoryOrchestrationService` does NOT expose action lookup — the skill needs direct repo access OR can use an enum of valid keys (`['responder', 'reclassificar', 'reencaminhar', 'cancelar']` from seed data).

```typescript
// Source: codebase — regulatory-action.entity.ts + regulatorio.seeder.ts + complaint-parsing.agent.ts pattern
const DetermineActionSchema = z.object({
  actionKey: z.enum(['responder', 'reclassificar', 'reencaminhar', 'cancelar']),
  justification: z.string(),
  confidence: z.number().min(0).max(1),
});

const { object, usage } = await generateObject({
  model,
  schema: DetermineActionSchema,
  system: systemPrompt,
  prompt: userPrompt,
  temperature: config.temperature,
});
await this.tokenUsageTracker.track({ stepExecutionId, model: config.modelId, ... });
return { actionKey: object.actionKey, justification: object.justification };
```

### Pattern 6: AuditTrail Skill — Append-Only Log Entry

**What:** Write a contextual AuditLog entry capturing the full execution snapshot. The AuditLog entity has no `updatedAt` (append-only).
**When to use:** AuditTrail skill only.

```typescript
// Source: codebase — audit-log.entity.ts (no updatedAt column)
const log = await this.auditLogRepo.save(
  this.auditLogRepo.create({
    action: 'skill_audit_trail',
    entityType: 'ticket_execution',
    entityId: input['ticketExecutionId'] as string,
    details: {
      complaintId: input['complaintId'],
      stepOutputs: input['stepOutputs'],
      tipologyKey: input['tipologyKey'],
      selectedActionKey: input['selectedActionKey'],
      slaDeadline: input['slaDeadline'],
    },
  }),
);
return { auditLogId: log.id };
```

### Pattern 7: TrackTokenUsage Skill — Aggregation Query

**What:** Query LlmCall table for all calls linked to the current execution's step executions, sum tokens and costs.
**When to use:** TrackTokenUsage skill only.

```typescript
// Source: codebase — llm-call.entity.ts, token-usage.entity.ts
// The skill aggregates — it does NOT call TokenUsageTrackerService.track()
// Individual tracking already happened per-LLM-call during AI skill execution
const ticketExecutionId = input['ticketExecutionId'] as string;
const result = await this.dataSource.query(`
  SELECT SUM(lc."totalTokens") AS total_tokens, SUM(lc."costUsd") AS total_cost_usd
  FROM "llm_call" lc
  INNER JOIN "step_execution" se ON lc."stepExecutionId" = se."id"
  WHERE se."ticketExecutionId" = $1
`, [ticketExecutionId]);
return {
  totalTokens: Number(result[0]?.total_tokens ?? 0),
  estimatedCostUsd: Number(result[0]?.total_cost_usd ?? 0),
};
```

### Pattern 8: Validation Skills — Rule-Based, No LLM

**What:** ValidateReclassification, ValidateReencaminhamento, ValidateCancelamento each validate their specific inputs against Anatel regulatory rules documented in the seeded `RegulatoryRule` and `RegulatoryAction` entities.
**When to use:** Validation skills only.

These are pure validation logic. No LLM calls. No artifact persistence. They return `{ isValid: boolean, errors: string[] }`.

---

## Artifact Type Map

**Canonical `artifactType` string values for all 11 artifact types (ART-01 through ART-11):**

| ART-ID | Skill That Creates It | `artifactType` String | Content Structure |
|--------|-----------------------|-----------------------|-------------------|
| ART-01 | LoadComplaint | `parsed_complaint` | `{ id, protocolNumber, rawText, tipologyKey, situationKey, source, externalId }` |
| ART-02 | NormalizeComplaintText | `normalized_text` | `{ originalText, normalizedText, changeCount }` |
| ART-03 | ComputeSla | `sla_calculation` | `{ slaDeadline, slaBusinessDays, isOverdue, tipologyKey, situationKey }` |
| ART-04 | RetrieveManualContext | `kb_context` | `{ chunks: [{content, similarity}], query, totalChunks }` |
| ART-05 | RetrieveIQITemplate | `iqi_template` | `{ templateId, templateName, templateContent, matchType }` |
| ART-06 | BuildMandatoryChecklist | `mandatory_checklist` | `{ checklist: [{fieldName, fieldLabel, isRequired, isPresent}], completionPercentage }` |
| ART-07 | DraftFinalResponse | `draft_response` | `{ draftResponse, templateUsed, mandatoryFieldsCount, kbChunksUsed }` |
| ART-08 | ComplianceCheck | `compliance_evaluation` | `{ isCompliant, complianceScore, violations, mandatoryFieldsStatus, recommendations }` |
| ART-09 | GenerateArtifact | `final_response` | `{ finalResponse, revisionsApplied }` |
| ART-10 | AuditTrail | `audit_trail` | `{ auditLogId, action, entityType, entityId, details }` |
| ART-11 | HumanDiffCapture | `human_diff` | `{ diffSummary: 'pending_human_review', changesCount: null }` |

Note: ART-04 through ART-09 already have partial artifact-like data in `stepExecution.output`. The artifact table persistence is what makes them formally ART-01 through ART-11. The `GenerateArtifact` skill in Phase 4 already routes to `FinalResponseComposerAgent` which produces `finalResponse` — this maps to ART-09.

---

## Module Wiring Changes Required

### ExecucaoModule must import MemoriaModule

**Problem:** `PersistMemory` skill needs `Repository<CaseMemory>` and `Repository<HumanFeedbackMemory>`. These entities are registered in `MemoriaModule` (via `TypeOrmModule.forFeature`), which exports `TypeOrmModule`. `ExecucaoModule` currently does NOT import `MemoriaModule`.

**Fix:** Add `MemoriaModule` to `ExecucaoModule.imports` array.

```typescript
// Source: codebase — execucao.module.ts + memoria.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([...]),
    OrquestracaoModule,
    OperacaoModule,
    IaModule,
    MemoriaModule,  // ADD — provides CaseMemory + HumanFeedbackMemory repos
  ],
  ...
})
export class ExecucaoModule {}
```

**No circular dependency risk:** `MemoriaModule` → `(no module imports)`, `ExecucaoModule` → `MemoriaModule` is a clean one-way dependency.

### ExecucaoModule needs Persona repo access

**Problem:** `ApplyPersonaTone` skill needs `Repository<Persona>`. `Persona` is registered in `RegulatorioModule` which `OrquestracaoModule` already imports. `ExecucaoModule` imports `OrquestracaoModule` which imports `RegulatorioModule` and exports `TypeOrmModule`.

**Check:** `RegulatorioModule` exports `TypeOrmModule` which makes ALL its feature repos available to importers. `OrquestracaoModule` imports `RegulatorioModule` and exports `TypeOrmModule`. `ExecucaoModule` imports `OrquestracaoModule`. This means `Persona` repo IS transitively available in `ExecucaoModule` through the `TypeOrmModule` export chain.

**Verification needed:** Confirm TypeORM feature repos re-export propagation works transitively in NestJS (it does when each module in the chain exports `TypeOrmModule`). This is HIGH confidence from existing codebase pattern.

### DataSource injection for TrackTokenUsage aggregation

**Problem:** The TrackTokenUsage skill needs `DataSource` for a raw aggregate query. `DataSource` is globally available in NestJS TypeORM — it can be injected via `@InjectDataSource()` in any service.

```typescript
// Source: NestJS TypeORM docs — DataSource is injectable
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

constructor(@InjectDataSource() private readonly dataSource: DataSource) {}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text normalization (NormalizeComplaintText) | Custom NLP | Simple string operations | Phase 5 scope: remove special chars, normalize whitespace, trim. Full NLP is Phase 6+ deferred |
| Embedding generation for CaseMemory | Custom HTTP call to OpenAI | `ModelSelectorService.getEmbeddingModel()` + `embed()` from `ai` SDK | Already wired, has API key resolution |
| Token aggregation for TrackTokenUsage | Another tracking service | Raw TypeORM `DataSource` query | Already persisted per-call; just aggregate |
| Diff computation for HumanDiffCapture | Myers diff algorithm | Phase 5 scope: return placeholder artifact | Real diff is Phase 6 (HITL); Phase 5 just scaffolds the artifact |
| Validation rules for Validate* skills | AI evaluation | Direct string/field validation against seeded RegulatoryAction.requiresJustification | Rules are already seeded, validation is deterministic |

**Key insight:** Phase 5 is not a greenfield build — it replaces 13 stubs with minimal real logic, leveraging existing services. The temptation to over-engineer (full NLP, Myers diff, LLM-based validation) should be resisted.

---

## Common Pitfalls

### Pitfall 1: CaseMemory embedding column NOT NULL violation
**What goes wrong:** `PersistMemory` saves a `CaseMemory` without generating an embedding — PostgreSQL throws `null value in column "embedding" violates not-null constraint`.
**Why it happens:** The `embedding` column in `case_memory` is `vector(1536) NOT NULL` per the migration. TypeORM entity has no default.
**How to avoid:** Always generate embedding via `ModelSelectorService.getEmbeddingModel()` + `embed()` before saving. Handle the case where OpenAI API is unavailable — if embedding fails, the skill should still succeed but log a warning and use a zero vector as fallback.
**Warning signs:** Test runs pass but DB inserts fail at runtime due to missing OPENAI_API_KEY in test environment.

### Pitfall 2: Missing complaintId in skill input
**What goes wrong:** Artifact persistence requires `complaintId`, but the skill input (which is `execution.metadata`) may not always contain `complaintId` explicitly.
**Why it happens:** `execution.metadata` is built from `ExecutionContext` — it contains `tipologyKey`, `stepOutputs`, etc., but `complaintId` must be explicitly added. Looking at `startExecution()`, the metadata does NOT include `complaintId` — it only has `tipologyKey`, `situationKey`, `slaBusinessDays`, `slaDeadline`, `selectedActionKey`, `stepOutputs`.
**How to avoid:** Pass `complaintId` as a 4th parameter to `SkillRegistryService.execute()` (from `execution.complaintId`). Do not attempt to derive it from metadata.
**Warning signs:** TypeORM throws FK violation on artifact insert with `complaintId = undefined`.

### Pitfall 3: ApplyPersonaTone with no Persona seeded
**What goes wrong:** `personaRepo.findOne({ where: { tipologyId, isActive: true } })` returns null for any tipologyId because no personas have been seeded.
**Why it happens:** The `regulatorio.seeder.ts` does NOT seed any `Persona` rows (confirmed by inspection). There is only the `Persona` entity and table.
**How to avoid:** ApplyPersonaTone must handle null persona gracefully — return `draftText` unchanged with `{ adjustedText: draftText, personaApplied: false }`. The seeder for Phase 5 should add at least one default persona per tipology.
**Warning signs:** Skill returns unchanged text without error but personaApplied is always false in all executions.

### Pitfall 4: SkillRegistryService duplicates injected services from TicketExecutionService
**What goes wrong:** Both `TicketExecutionService` and `SkillRegistryService` inject the same services (artifactRepo, AI agents, etc.), creating bloated module DI.
**Why it happens:** If `TicketExecutionService` keeps its existing service dependencies AND calls `SkillRegistryService`, and `SkillRegistryService` also injects everything, there are duplicated injections.
**How to avoid:** Move ALL skill-related service dependencies from `TicketExecutionService` to `SkillRegistryService`. `TicketExecutionService` should only inject: execution repos (TicketExecution, StepExecution, StepDefinition, StepSkillBinding, SkillDefinition, Complaint, AuditLog) + RegulatoryOrchestrationService + the new SkillRegistryService. The AI agents, KB services, memory repos, persona repo — all move to SkillRegistryService.
**Warning signs:** `TicketExecutionService` constructor becomes enormous (15+ parameters).

### Pitfall 5: HumanDiffCapture tries to read HumanReview that doesn't exist yet
**What goes wrong:** HumanDiffCapture skill in Phase 5 tries to load a `HumanReview` record to compute the diff, but HumanReview creation is Phase 6 (HITL).
**Why it happens:** The SkillDefinition input schema shows `{ aiDraft, humanFinal, reviewId }` — Phase 5 doesn't have `humanFinal` yet.
**How to avoid:** In Phase 5, HumanDiffCapture returns a placeholder artifact: `{ diffSummary: 'pending_human_review', changesCount: null }`. The artifact IS persisted (ART-11 exists as a record), but its content is a placeholder until Phase 6 populates it.
**Warning signs:** Any attempt to load `humanFinal` or `reviewId` from input in Phase 5 — those values don't exist yet.

### Pitfall 6: TrackTokenUsage uses TokenUsageTrackerService.track() instead of aggregating
**What goes wrong:** The skill re-tracks tokens (creating duplicate LlmCall rows) instead of reading existing ones.
**Why it happens:** Naming confusion — `TokenUsageTrackerService` is used during AI skill execution to track each LLM call. The `TrackTokenUsage` skill is a summary/aggregation step, not an additional tracking step.
**How to avoid:** The TrackTokenUsage skill must NOT call `tokenUsageTracker.track()`. It reads existing `llm_call` rows via DataSource query and returns aggregated totals.
**Warning signs:** LlmCall rows are created without a corresponding real LLM call.

### Pitfall 7: ComputeSla skill redundant with startExecution() SLA computation
**What goes wrong:** SLA has already been computed and stored in `complaint.slaDeadline` during `startExecution()`. The `ComputeSla` skill computing it again leads to inconsistency.
**Why it happens:** `startExecution()` already calls `orchService.computeSla()` and saves to complaint. The skill should read from the execution metadata (`input['slaDeadline']`, `input['slaBusinessDays']`), not recompute.
**How to avoid:** `ComputeSla` skill reads `input['slaDeadline']` and `input['slaBusinessDays']` from the execution metadata (already there since `startExecution()` stores them), creates an ART-03 artifact with this data, and returns. No recomputation.
**Warning signs:** SLA deadline differs between complaint record and ART-03 artifact.

---

## Code Examples

### LoadComplaint Skill — Load Full Complaint Entity

```typescript
// Source: codebase — complaint.entity.ts, ticket-execution.service.ts startExecution()
case 'LoadComplaint': {
  const complaintId = input['complaintId'] as string ?? input['id'] as string;
  const complaint = await this.complaintRepo.findOne({
    where: { id: complaintId },
    relations: ['tipology', 'situation', 'subtipology'],
  });
  if (!complaint) return { error: 'Complaint not found', complaintId };

  const artifact = await this.artifactRepo.save(
    this.artifactRepo.create({
      artifactType: 'parsed_complaint',
      content: {
        id: complaint.id,
        protocolNumber: complaint.protocolNumber,
        rawText: complaint.rawText,
        tipologyKey: complaint.tipology?.key ?? null,
        situationKey: complaint.situation?.key ?? null,
        source: complaint.source,
        externalId: complaint.externalId,
        status: complaint.status,
      },
      version: 1,
      stepExecutionId,
      complaintId: complaint.id,
    }),
  );

  return {
    complaint: { id: complaint.id, protocolNumber: complaint.protocolNumber },
    tipologyId: complaint.tipologyId,
    situationId: complaint.situationId,
    tipologyKey: complaint.tipology?.key ?? null,
    artifactId: artifact.id,
  };
}
```

### NormalizeComplaintText Skill — String Normalization

```typescript
// Source: codebase — complaint.entity.ts rawText field, skill output schema
case 'NormalizeComplaintText': {
  const rawText = (input['rawText'] as string) ?? (input['complaintText'] as string) ?? '';

  // Phase 5: basic normalization — remove extra whitespace, normalize diacritics, trim
  const normalizedText = rawText
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .trim();

  const artifact = await this.artifactRepo.save(
    this.artifactRepo.create({
      artifactType: 'normalized_text',
      content: { originalText: rawText, normalizedText, changeCount: rawText.length - normalizedText.length },
      version: 1,
      stepExecutionId,
      complaintId: complaintId,
    }),
  );

  return { normalizedText, artifactId: artifact.id };
}
```

### PersistMemory Skill — CaseMemory with Embedding

```typescript
// Source: codebase — case-memory.entity.ts, vector-search.service.ts embed() pattern
case 'PersistMemory': {
  const stepOutputs = input['stepOutputs'] as Record<string, Record<string, unknown>> ?? {};
  const finalResponse = (stepOutputs['GenerateArtifact']?.['finalResponse'] as string) ?? '';
  const tipologyKey = input['tipologyKey'] as string ?? '';
  const actionKey = input['selectedActionKey'] as string ?? null;

  const summaryText = `Reclamação tipologia ${tipologyKey}, ação: ${actionKey ?? 'responder'}. ${finalResponse.slice(0, 300)}`;

  const embeddingModel = await this.modelSelector.getEmbeddingModel();
  const { embedding } = await embed({ model: embeddingModel, value: summaryText });

  const caseMemory = await this.caseMemoryRepo.save(
    this.caseMemoryRepo.create({
      summary: summaryText,
      decision: actionKey,
      outcome: actionKey,
      responseSnippet: finalResponse.slice(0, 500) || null,
      embedding: pgvector.toSql(embedding) as unknown as string,
      complaintId,
      tipologyId: input['tipologyId'] as string ?? null,
    }),
  );

  return { memoryId: caseMemory.id };
}
```

### ValidateReclassification Skill — Deterministic Validation

```typescript
// Source: codebase — regulatorio.seeder.ts rules RECLASSIFICAR_JUSTIFICATIVA
case 'ValidateReclassification': {
  const originalTipologyKey = input['originalTipologyKey'] as string;
  const newTipologyKey = input['newTipologyKey'] as string;
  const justification = input['justification'] as string;

  const errors: string[] = [];

  if (!originalTipologyKey) errors.push('originalTipologyKey obrigatório');
  if (!newTipologyKey) errors.push('newTipologyKey obrigatório');
  if (originalTipologyKey === newTipologyKey) errors.push('Nova tipologia deve ser diferente da original');
  if (!justification || justification.trim().length < 10) {
    errors.push('Justificativa obrigatória (mínimo 10 caracteres) — conforme Manual Anatel Seção 6.1');
  }

  return { isValid: errors.length === 0, errors };
}
```

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| Switch in TicketExecutionService (13 stubs) | SkillRegistryService with full implementations | Phase 5 change | Separates concerns; TicketExecutionService handles orchestration, SkillRegistryService handles execution |
| Token tracking per-call inline | TokenUsageTrackerService.track() in each AI skill | Already done in Phase 4 | TrackTokenUsage skill is now an aggregation, not new tracking |
| No memory persistence | CaseMemory via PersistMemory skill | Phase 5 new | Enables future RAG on case history |

**Not changing in Phase 5:**
- `DetermineRegulatoryAction` in the existing stub returns `{ actionKey: 'responder' }` — it needs upgrade to real `generateObject` call
- AuditLog is already used by `TicketExecutionService` for `execution_started`, `step_completed`, `execution_finalized` — the `AuditTrail` skill adds a `skill_audit_trail` entry with the full execution snapshot

---

## Open Questions

1. **Should skills migrate out of TicketExecutionService or stay as a refactored method?**
   - What we know: The existing executeSkill() is private, already handles the switch, 6 skills have real implementations
   - What's unclear: Whether a separate SkillRegistryService class is worth the refactor overhead vs. expanding the existing method
   - Recommendation: Extract to SkillRegistryService for cleanliness (it will have 15+ service dependencies otherwise in TicketExecutionService), but this is a discretionary architecture decision

2. **Persona seeding — should Phase 5 add a PersonaSeeder?**
   - What we know: No Persona rows are seeded currently; ApplyPersonaTone will always return `personaApplied: false`
   - What's unclear: Whether a persona per tipology is required for Phase 5 acceptance or acceptable as Phase 6 config
   - Recommendation: Add a minimal PersonaSeeder in Phase 5 (one default persona with formalityLevel=3, empathyLevel=3 for all tipologies) to make ApplyPersonaTone testable

3. **complaintId availability in SkillRegistry**
   - What we know: `execution.complaintId` is available in TicketExecutionService.advanceStep() but skill input (execution.metadata) does not explicitly contain complaintId
   - What's unclear: Cleanest way to pass complaintId to SkillRegistryService
   - Recommendation: Pass as explicit 4th parameter `complaintId: string` to `SkillRegistryService.execute()`. Update the call site in `TicketExecutionService.advanceStep()` to pass `execution.complaintId`.

4. **DetermineRegulatoryAction LLM prompt model config**
   - What we know: ModelSelectorService uses functionalityType keys like 'classificacao', 'composicao', 'avaliacao'
   - What's unclear: Which functionalityType to use for DetermineRegulatoryAction — closest is 'classificacao' (light, structured output)
   - Recommendation: Use 'classificacao' functionalityType (same as ClassifyTypology) since it uses generateObject with a constrained enum schema

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `/backend/src/modules/execucao/services/ticket-execution.service.ts` — existing executeSkill() switch with 6 real + 13 stubs
- `/backend/src/modules/execucao/entities/artifact.entity.ts` — artifact schema, complaintId + stepExecutionId FKs
- `/backend/src/modules/execucao/entities/audit-log.entity.ts` — append-only, no updatedAt
- `/backend/src/modules/memoria/entities/case-memory.entity.ts` — embedding vector(1536) NOT NULL
- `/backend/src/modules/memoria/entities/human-feedback-memory.entity.ts` — aiText + humanText + embedding
- `/backend/src/modules/memoria/memoria.module.ts` — exports TypeOrmModule only, no services exported
- `/backend/src/modules/regulatorio/entities/persona.entity.ts` — formalityLevel, empathyLevel, assertivenessLevel, requiredExpressions, forbiddenExpressions
- `/backend/src/modules/execucao/execucao.module.ts` — current imports (no MemoriaModule)
- `/backend/src/modules/ia/ia.module.ts` — AI agents and ModelSelectorService exported
- `/backend/src/modules/ia/services/token-usage-tracker.service.ts` — creates LlmCall + TokenUsage records per call
- `/backend/src/database/seeds/orquestracao.seeder.ts` — all 19 SkillDefinition records with input/output schemas
- `/backend/src/database/seeds/regulatorio.seeder.ts` — RegulatoryAction keys (responder, reclassificar, reencaminhar, cancelar), RegulatoryRule codes
- `/backend/src/database/migrations/1773774004000-CreateExecucaoTables.ts` — artifact table DDL with both FKs
- `/backend/src/database/migrations/1773774005000-CreateMemoriaTables.ts` — case_memory embedding NOT NULL
- `/backend/src/modules/ia/services/complaint-parsing.agent.ts` — generateObject + embed() pattern reference

---

## Metadata

**Confidence breakdown:**
- Skill-to-artifact mapping: HIGH — derived from ART specs in requirements and entity inspection
- MemoriaModule wiring gap: HIGH — confirmed by module inspection (MemoriaModule not in ExecucaoModule.imports)
- Persona seeding gap: HIGH — confirmed by regulatorio.seeder.ts inspection (no Persona rows seeded)
- SkillRegistryService architecture: MEDIUM — architectural recommendation, no single authoritative source
- DetermineRegulatoryAction functionalityType selection: MEDIUM — inferred from model config patterns

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain — no external dependencies changing)
