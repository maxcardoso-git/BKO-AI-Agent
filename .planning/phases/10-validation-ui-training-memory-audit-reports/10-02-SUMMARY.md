---
phase: 10
plan: 02
subsystem: memory-feedback-loop
tags: [skill-registry, prompt-builder, memory-injection, operator-note, hitl-training]
requires: ["10-01"]
provides: ["draft_response artifact with injectedCorrections", "LLM prompt with human correction examples", "loadComplaint exposes operatorNote"]
affects: ["10-03-validation-ui"]
tech-stack:
  added: []
  patterns: ["env-var-runtime-tuning", "artifact-co-located-audit-trail", "correction-only-injection-filter"]
key-files:
  created: []
  modified:
    - backend/src/modules/execucao/execucao.module.ts
    - backend/src/modules/execucao/services/skill-registry.service.ts
    - backend/src/modules/ia/services/prompt-builder.service.ts
decisions:
  - "Rejections excluded from prompt injection — injecting rejections teaches LLM to imitate bad drafts"
  - "MEMORY_INJECTION_LIMIT env var (default 3) allows ops to tune at runtime without redeploy"
  - "injectedCorrections persisted in draft_response artifact (not separate endpoint) — keeps audit trail co-located with the draft"
  - "Text truncated at 800 chars per field (aiText/humanText) and 500 chars (diffDescription) to respect LLM token budget"
  - "tipologyId empty guard added to DraftFinalResponse — skips memory retrieval with logger.warn"
  - "Task 0: noteRepo injected into SkillRegistryService via ExecucaoModule.forFeature — OperacaoModule already imported (decision 08-01)"
metrics:
  duration: "~2 min"
  completed: "2026-05-26"
---

# Phase 10 Plan 02: Draft Prompt and Memory Injection Summary

**One-liner:** Correction-typed feedback from `human_feedback_memory` now flows into LLM prompts as labeled examples and into `draft_response` artifacts as `injectedCorrections`, closing the training loop from Phase 10-01 persistence.

## Objective

Wire the Phase 10 training-memory feedback loop: DraftFinalResponse retrieves CORRECTION-typed feedback (rejections filtered out), injects them as labeled examples in the prompt, and surfaces them as a structured field on `draft_response` artifact for the validation UI.

## Tasks Executed

### Task 0 (User-requested, outside original plan): Fix `loadComplaint` operatorNote gap

**Problem:** `PromptBuilderService` (lines 145-160) already had a wired "NOTA DO OPERADOR" section that injected `ctx.operatorNote` + `ctx.operatorNoteParameters`, and `DraftGeneratorAgent` already read those fields — but `loadComplaint` in `skill-registry.service.ts` never queried `complaint_user_note`. Result: the operator note was invisibly dropped at source; the LLM never saw operator-entered data (e.g., "paid value: R$150 on 2026-05-20"). This gap existed since Phase 8-03.

**Fix (2 files):**

1. `backend/src/modules/execucao/execucao.module.ts` — Added `ComplaintUserNote` to `TypeOrmModule.forFeature` array (line 47). Import from `../operacao/entities/complaint-user-note.entity`.

2. `backend/src/modules/execucao/services/skill-registry.service.ts`:
   - Import `ComplaintUserNote` entity (line 11)
   - Inject `@InjectRepository(ComplaintUserNote) private readonly noteRepo` in constructor (lines 75-76)
   - In `loadComplaint()`, after `complaintRepo.findOne`, query: `noteRepo.findOne({ where: { complaintId, isActive: true }, order: { version: 'DESC' } })` wrapped in try/catch with `logger.warn` — failure is non-fatal
   - Add `operatorNote: note?.content ?? null` and `operatorNoteParameters: note?.parameters ?? null` to the return map (lines 488-489)

**Commit:** `9d42800` — `fix(10-02): loadComplaint reads active complaint_user_note and exposes operatorNote downstream`

**Verification note:** Cannot E2E test locally (remote DB at 72.61.52.70:5433). Flow must be verified on server after deploy: create a note via `/api/operacao/complaints/:id/notes`, trigger a pipeline run, inspect the draft_response or prompt logs for the operator note content.

---

### Task 1: DraftFinalResponse — switch to findSimilarFeedback + expose injectedCorrections

**Files modified:** `backend/src/modules/execucao/services/skill-registry.service.ts`

**Line range:** `DraftFinalResponse` case block (~lines 253-332 post-edit)

**Changes:**

1. **Replaced `findSimilarCorrections` with `findSimilarFeedback`:**
   ```typescript
   this.memoryRetrieval.findSimilarFeedback(memEmbedding, tipologyId, 'correction', injectionLimit)
   ```
   WHY rejection filter: injecting rejections would teach LLM to imitate AI drafts that operators rejected — exactly backwards.

2. **Added `MEMORY_INJECTION_LIMIT` env var** (default 3):
   ```typescript
   const injectionLimit = Number(process.env.MEMORY_INJECTION_LIMIT ?? '3');
   ```

3. **Added `tipologyId` empty guard** — skips memory retrieval block entirely with `logger.warn` when tipologyId is absent.

4. **Sanitized corrections** before storing/using:
   ```typescript
   injectedCorrections = humanCorrectionsRaw.map(c => ({
     aiText: c.aiText?.slice(0, 800) ?? '',
     humanText: c.humanText?.slice(0, 800) ?? '',
     diffDescription: c.diffDescription?.slice(0, 500) ?? '',
     similarity: typeof c.similarity === 'number' ? Number(c.similarity.toFixed(3)) : null,
   }));
   ```

5. **Logger line per call:**
   ```
   [DraftFinalResponse] Injected N past corrections (tipologyId=T)
   ```

6. **Persisted in artifact:**
   ```typescript
   content: {
     draftResponse, templateUsed, mandatoryFieldsCount, kbChunksUsed,
     injectedCorrections,           // array of {aiText, humanText, diffDescription, similarity}
     injectedCorrectionsCount,      // length — convenience field for UI badge
   }
   ```

**Commit:** `9d42800` (same commit as Task 0 — both edits were in skill-registry.service.ts, staged together)

---

### Task 2: PromptBuilder — render injected corrections inside draft prompt

**Files modified:** `backend/src/modules/ia/services/prompt-builder.service.ts`

**Line range:** `buildDraftResponsePrompt` method, humanCorrections block (~lines 177-207 post-edit)

**Change:** Replaced the condensed one-liner per correction with a full labeled block format:

```
## Exemplos de Correcoes Humanas Anteriores (Aprendizado)

Os exemplos abaixo mostram como operadores corrigiram rascunhos previos para casos similares.
USE essas correcoes como guia: evite os padroes que foram corrigidos e adote o estilo das versoes humanas.

### Exemplo 1 (similaridade 87%)
**Rascunho IA original:**
<aiText>

**Versao corrigida pelo operador:**
<humanText>

**Resumo da correcao:**
<diffDescription>
---
```

**Section position:** AFTER operator note section (NOTA DO OPERADOR), BEFORE kb chunks (Contexto regulatorio relevante). This aligns with prompt-engineering best practice — examples near the task description.

**Empty guard:** Section is omitted entirely when `humanCorrections` array is empty or absent — no dangling header.

**Commit:** `829960d` — `feat(10-02): PromptBuilderService renders full injected corrections block in draft prompt`

---

## New Artifact Content Schema

`draft_response` artifact `content` now:

```typescript
{
  draftResponse: string,               // the generated draft text
  templateUsed: string | null,         // IQI template ID if used
  mandatoryFieldsCount: number,        // count of mandatory fields resolved
  kbChunksUsed: number,                // KB chunks injected
  injectedCorrections: Array<{         // NEW — sanitized correction examples injected into prompt
    aiText: string,                    //   original AI draft (max 800 chars)
    humanText: string,                 //   human-corrected version (max 800 chars)
    diffDescription: string,           //   summary of the change (max 500 chars)
    similarity: number | null,         //   cosine similarity score (3 decimal places)
  }>,
  injectedCorrectionsCount: number,    // NEW — length of above array (UI badge convenience)
}
```

## Environment Variables

| Variable | Default | Effect |
|---|---|---|
| `MEMORY_INJECTION_LIMIT` | `3` | Max number of past corrections injected per draft run |

## Deviations from Plan

### Auto-included (not a deviation): Task 0 executed first per user instruction

Task 0 was a user-mandated prerequisite. Included in skill-registry.service.ts staging before Task 1 edits, resulting in a single combined commit for Task 0 + Task 1 (both in same file). Task 2 committed separately.

### No other deviations

Plan executed as written. Prompt-builder already had the `humanCorrections` interface type declared (line 40) and the partial rendering block (lines 177-183) — Task 2 expanded that block rather than adding a new one.

## Next Phase Readiness

- **10-03 Validation UI** can read `injectedCorrections` + `injectedCorrectionsCount` directly from the `draft_response` artifact — no separate API endpoint needed
- Operator note flow is now end-to-end: note saved via `/api/operacao/complaints/:id/notes` → `loadComplaint` exposes `operatorNote` → `PromptBuilderService` injects "NOTA DO OPERADOR" section → LLM sees factual data
- `MEMORY_INJECTION_LIMIT` can be set per environment in pm2 ecosystem or `.env`
