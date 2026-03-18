# Phase 7: Polish & Compliance - Research

**Researched:** 2026-03-18
**Domain:** Memory/learning services, admin CRUD UI, observability dashboards, LGPD security controls
**Confidence:** HIGH

## Summary

Phase 7 finalizes the BKO Agent platform across four parallel tracks: memory-driven AI improvement (MEM), governed persona catalog (PERS/CONF), full configuration admin UI (CONF), and observability dashboards with LGPD/security controls (OBS/SEC).

The codebase is in excellent shape for Phase 7. All DB entities already exist (CaseMemory, HumanFeedbackMemory, StyleMemory, Persona, AuditLog, TokenUsage, LlmCall, LlmModelConfig, ResponseTemplate, SkillDefinition, Capability). The VectorSearchService, embed() AI SDK integration, and raw pgvector query patterns are established. The memory insertion pattern in PersistMemorySkill (raw INSERT with pgvector.toSql()) is the confirmed pattern for all vector writes. Phase 7 is mostly about wiring what's seeded into query services and building the admin/observability UI layers.

The main new libraries needed are: recharts (for dashboard charts — must use `"use client"` boundary, requires `overrides.react-is` in package.json for React 19 compatibility), and shadcn chart component (thin Recharts wrapper that matches existing UI system). No new backend libraries are required. The HumanDiffCapture workflow (human_diff artifact with aiDraft/humanFinal) feeds directly into HumanFeedbackMemory — the Phase 6 HumanReviewService already stores the diff; Phase 7 needs a service that turns those stored diffs into HumanFeedbackMemory rows with vector embeddings. The RolesGuard is already APP_GUARD globally — admin endpoints only need `@Roles('admin')` decorators added.

**Primary recommendation:** Build memory services first (07-01) to unblock AI context injection, then do admin CRUD UI (07-02) since personas/templates are DB-driven with no recompile needed, then observability (07-03) using pure SQL aggregations served as REST endpoints, then security layer (07-04) as a global NestJS interceptor + frontend masking utilities.

## Standard Stack

### Core (already installed — no new installs on backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgvector (npm) | 0.2.x | Raw vector SQL helper (toSql) | Established in Phase 4 — all vector writes use this |
| ai SDK | 6.0.116 | embed() for generating memory embeddings | Already used in PersistMemory skill |
| TypeORM DataSource | 0.3.x | Raw queries for vector columns | TypeORM cannot handle vector columns via ORM layer |
| diff (npm) | 8.0.0 | diffWords() for human/AI text diff | Already used in HumanReviewService |

### New Frontend Libraries Required

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^2.15.x | Chart primitives for dashboards | shadcn/ui chart component is built on recharts |
| shadcn chart | latest | ChartContainer/ChartTooltip wrappers | Matches existing shadcn UI system exactly |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts via shadcn | visx or nivo | Recharts already used in shadcn ecosystem; visx/nivo would introduce new paradigms with no benefit |
| raw SQL aggregations | TypeORM QueryBuilder | Raw SQL is cleaner for multi-join aggregations; QueryBuilder verbose for this; raw pattern established in Phase 4 |
| NestJS interceptor for masking | External library | Custom interceptor is 20 lines; no library needed |

**Installation (frontend only):**
```bash
# In frontend/
npm install recharts --legacy-peer-deps
# Add to package.json overrides for React 19 compatibility:
# "overrides": { "react-is": "^19.0.0-rc-69d4b800-20241021" }
# Then: npx shadcn@latest add chart
```

## Architecture Patterns

### Recommended Project Structure (new files only)

```
backend/src/modules/
├── memoria/
│   ├── services/
│   │   ├── memory-retrieval.service.ts    # similarity search for cases + corrections
│   │   └── memory-feedback.service.ts     # convert human_diff → HumanFeedbackMemory rows
├── regulatorio/
│   ├── controllers/
│   │   └── admin-config.controller.ts     # CRUD for personas, templates, skills, capabilities, LLM models
│   └── services/
│       └── admin-config.service.ts
├── execucao/
│   ├── controllers/
│   │   └── observability.controller.ts    # dashboard metrics + trace explorer + ticket logs
│   └── services/
│       └── observability.service.ts       # raw SQL aggregations
└── (global interceptor)
    └── interceptors/
        └── sensitive-data.interceptor.ts  # CPF/phone redaction in logs

frontend/src/app/admin/
├── personas/                     # PERS-01..03 + CONF-01
├── templates/                    # CONF-02
├── skills/                       # CONF-04
├── capabilities/                 # CONF-05
├── models/                       # CONF-06
└── steps/ (already built)        # CONF-03

frontend/src/app/admin/
├── observability/
│   ├── page.tsx                  # metric panels (OBS-01..06, OBS-09)
│   └── trace/[execId]/page.tsx  # Trace Explorer (OBS-07)

frontend/src/app/tickets/
└── [id]/logs/page.tsx           # per-ticket logs (OBS-08)
```

### Pattern 1: Memory Retrieval Service (pgvector cosine similarity)

**What:** Query CaseMemory and HumanFeedbackMemory by embedding similarity to inject into PromptBuilderService
**When to use:** Before DraftFinalResponse and ComplianceCheck skill execution

```typescript
// Pattern established in VectorSearchService — reuse exactly
// Source: backend/src/modules/base-de-conhecimento/services/vector-search.service.ts
async findSimilarCases(
  embedding: number[],
  tipologyId: string,
  limit = 3,
): Promise<CaseMemory[]> {
  const rows = await this.dataSource.query(
    `SELECT id, summary, decision, outcome, "responseSnippet",
            1 - (embedding <=> $1::vector) AS similarity
     FROM case_memory
     WHERE "isActive" = true AND "tipologyId" = $2
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $3`,
    [pgvector.toSql(embedding), tipologyId, limit],
  );
  return rows;
}
```

### Pattern 2: HumanFeedback → Memory Pipeline

**What:** After human review submission, HumanReviewService already stores aiDraft/humanFinal in human_diff artifact. A new MemoryFeedbackService reads those artifacts and inserts HumanFeedbackMemory rows with embeddings.
**When to use:** Triggered by HumanReviewService.submitReview() completion

```typescript
// Source: pattern from PersistMemory skill (skill-registry.service.ts line 762)
// raw INSERT with pgvector.toSql() is mandatory for vector columns
await this.dataSource.query(
  `INSERT INTO "human_feedback_memory"
   ("id","aiText","humanText","diffDescription","correctionCategory","correctionWeight","embedding","complaintId","tipologyId")
   VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6::vector,$7,$8)
   RETURNING "id"`,
  [aiText, humanText, diffDesc, category, 1.0, pgvector.toSql(embedding), complaintId, tipologyId],
);
```

### Pattern 3: Observability Aggregations (raw SQL)

**What:** The dashboard needs avg latency per step, cost per ticket, error rates, HITL rates. All data is in existing step_execution and llm_call tables.
**When to use:** Dashboard API endpoints, queried on page load

```typescript
// Source: pattern from TrackTokenUsage skill (skill-registry.service.ts line 797)
// Avg latency per step key
const rows = await this.dataSource.query(
  `SELECT "stepKey",
          AVG("durationMs") AS avg_latency_ms,
          COUNT(*) AS total_executions,
          SUM(CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END) AS error_count
   FROM step_execution
   WHERE "createdAt" > NOW() - INTERVAL '30 days'
   GROUP BY "stepKey"
   ORDER BY avg_latency_ms DESC`,
);

// Cost per ticket
const costRows = await this.dataSource.query(
  `SELECT te."complaintId",
          SUM(lc."costUsd") AS total_cost_usd,
          SUM(lc."totalTokens") AS total_tokens
   FROM ticket_execution te
   INNER JOIN step_execution se ON se."ticketExecutionId" = te."id"
   INNER JOIN llm_call lc ON lc."stepExecutionId" = se."id"
   GROUP BY te."complaintId"`,
);

// HITL rate
const hitlRows = await this.dataSource.query(
  `SELECT
     COUNT(*) FILTER (WHERE status = 'waiting_human') AS hitl_count,
     COUNT(*) AS total_count
   FROM step_execution`,
);
```

### Pattern 4: Admin CRUD — No Recompile (CONF-07)

**What:** All config entities (Persona, ResponseTemplate, SkillDefinition, Capability, LlmModelConfig) are DB-driven. CRUD via REST endpoints + React server actions updates DB without restart.
**Key constraint:** The `@Roles('admin')` decorator is already available via RolesGuard (APP_GUARD). Add it to all admin endpoints.

```typescript
// Source: backend/src/modules/auth/auth.module.ts — RolesGuard registered as APP_GUARD
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../operacao/entities/user.entity';

@Controller()
export class AdminConfigController {
  @Get('admin/personas')
  @Roles(UserRole.ADMIN)
  listPersonas(): Promise<Persona[]> { ... }

  @Post('admin/personas')
  @Roles(UserRole.ADMIN)
  createPersona(@Body() dto: CreatePersonaDto): Promise<Persona> { ... }
}
```

### Pattern 5: CPF/Phone Masking — NestJS Interceptor

**What:** Global response interceptor that recursively scans response objects and redacts CPF (11-digit Brazilian tax ID) and phone numbers before serialization to the HTTP response.
**When to use:** Register in main.ts as a global interceptor

```typescript
// Pattern: NestJS response interceptor
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE_REGEX = /\b(\(?\d{2}\)?\s?)[\d\s\-]{8,10}\b/g;

function redactSensitive(data: unknown): unknown {
  if (typeof data === 'string') {
    return data.replace(CPF_REGEX, '***.***.***-**').replace(PHONE_REGEX, '(**) ****-****');
  }
  if (Array.isArray(data)) return data.map(redactSensitive);
  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, redactSensitive(v)])
    );
  }
  return data;
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(data => redactSensitive(data)));
  }
}
```

### Pattern 6: Recharts Charts as Client Components

**What:** Recharts requires browser APIs. All chart components must have `"use client"` at the top. Data is fetched server-side and passed as props.
**When to use:** Any component rendering a Recharts chart

```typescript
// Source: shadcn/ui chart docs + Next.js use-client directive
'use client';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

// Data fetched in parent Server Component, passed as prop
export function LatencyBarChart({ data }: { data: { stepKey: string; avgLatencyMs: number }[] }) {
  return (
    <ChartContainer config={{ avgLatencyMs: { label: 'Latência (ms)', color: 'hsl(var(--chart-1))' } }}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="stepKey" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="avgLatencyMs" fill="var(--color-avgLatencyMs)" />
      </BarChart>
    </ChartContainer>
  );
}
```

### Pattern 7: Prompt/Template Versioning (SEC-05)

**What:** ResponseTemplate already has a `version: number` field. LlmModelConfig does not need versioning (it's a config, not a prompt artifact). Versioning means: on update, increment version column rather than overwriting. For audit trail, AuditLog appends the old/new state.
**Implementation:** Add `@Roles('admin')` PATCH endpoint that increments version and logs to AuditLog before saving.

### Pattern 8: Compliance Score Calculation (OBS-09)

**What:** Per-ticket compliance score aggregated from ComplianceCheck artifact (already produced by ComplianceEvaluatorAgent). The `complianceScore` field is stored in the `compliance_evaluation` artifact.content. The observability endpoint queries artifacts by type and averages scores.

```typescript
// Query compliance artifacts
const rows = await this.dataSource.query(
  `SELECT (a.content->>'complianceScore')::float AS score,
          te."complaintId",
          c."tipologyId"
   FROM artifact a
   INNER JOIN step_execution se ON a."stepExecutionId" = se."id"
   INNER JOIN ticket_execution te ON se."ticketExecutionId" = te."id"
   INNER JOIN complaint c ON te."complaintId" = c."id"
   WHERE a."artifactType" = 'compliance_evaluation'
   ORDER BY a."createdAt" DESC`,
);
```

### Anti-Patterns to Avoid

- **Recharts in Server Component:** Always add `"use client"` — Recharts uses window/browser APIs and will crash during SSR.
- **TypeORM vector column insert via repo.save():** TypeORM cannot serialize vector type. Always use raw `dataSource.query()` with `pgvector.toSql()` (established in Phase 4/5).
- **Creating new HumanFeedbackMemory entity fields:** The entity already has all needed fields (aiText, humanText, diffDescription, correctionCategory, correctionWeight, embedding). Don't add new columns — no migration needed.
- **Registering RolesGuard separately:** RolesGuard is already registered as APP_GUARD globally. Just add `@Roles('admin')` decorator — don't re-register the guard.
- **Global SensitiveDataInterceptor on all routes:** Apply the masking interceptor only to complaint-related response routes (or scope it to avoid performance penalty on all 50+ endpoints). Consider applying at controller level for complaint/execution controllers, not globally.
- **react-is missing for recharts:** npm will throw peer dep error. Always add `overrides.react-is` in frontend/package.json matching React version.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart UI components | Custom SVG charts | recharts + shadcn chart | Recharts handles responsive layout, tooltips, axes, legends |
| CPF regex | Custom parser | Simple regex + interceptor | CPF format is well-known; 2-line regex is sufficient for masking |
| Vector similarity search | Manual cosine math | pgvector `<=>` operator | Already in DB; pattern established in VectorSearchService |
| Human diff computation | Custom diff algorithm | `diff` package (already installed) | `diffWords()` already used in HumanReviewService |
| Memory embedding generation | Custom embedding API call | `embed()` from ai SDK via ModelSelectorService | Already established in PersistMemory skill |
| Role-based access control | Custom guard | Existing RolesGuard (APP_GUARD) | Already registered globally — just add `@Roles('admin')` |

**Key insight:** This phase is 70% wiring existing infrastructure, 30% new UI. The DB schema, guards, vector search, and embedding patterns are all established. The risk is in chart library setup (React 19 peer dep) and ensuring aggregation SQL correctness.

## Common Pitfalls

### Pitfall 1: recharts React 19 Peer Dependency
**What goes wrong:** `npm install recharts` fails with peer dependency conflict because recharts depends on `react-is` which hasn't been updated for React 19.
**Why it happens:** recharts v2.x declares `react-is` as a peer dependency with an older version range.
**How to avoid:** Add to frontend/package.json before installing:
```json
"overrides": {
  "react-is": "^19.0.0-rc-69d4b800-20241021"
}
```
Then run: `npm install recharts --legacy-peer-deps`
**Warning signs:** npm throws `ERESOLVE` or peer dependency errors during install.

### Pitfall 2: Recharts SSR Crash
**What goes wrong:** Build passes but runtime throws "window is not defined" or similar.
**Why it happens:** Recharts accesses browser globals during module initialization.
**How to avoid:** Always put `'use client'` at the top of any file that imports from recharts. Do not import recharts in Server Components. If needed in a Server Component tree, use `dynamic(() => import('./chart'), { ssr: false })`.
**Warning signs:** Build succeeds but dev server throws hydration errors.

### Pitfall 3: Vector Insert via TypeORM ORM Layer
**What goes wrong:** `repo.save(entity)` fails with "column type not supported" or silently stores null for the embedding column.
**Why it happens:** TypeORM's PostgreSQL driver does not natively serialize the `vector` type.
**How to avoid:** Always use `dataSource.query('INSERT ... $N::vector', [pgvector.toSql(embedding)])` — the established pattern from PersistMemory (Phase 5).
**Warning signs:** Embedding column shows null in DB even though insertion succeeded.

### Pitfall 4: RolesGuard Already Registered
**What goes wrong:** Developer adds a second `APP_GUARD` provider for RolesGuard in a module, causing double-evaluation or conflicts.
**Why it happens:** RolesGuard is APP_GUARD in AuthModule but may look "missing" since no `@Roles()` decorators appear on current controllers.
**How to avoid:** Only add `@Roles(UserRole.ADMIN)` decorators to endpoints. The guard is already active globally.
**Warning signs:** All endpoints start returning 403 (double guard evaluation).

### Pitfall 5: Memory Context Injection in PromptBuilderService
**What goes wrong:** Memory retrieval happens but context is never passed to the AI because PromptBuilderService.buildDraftResponsePrompt() doesn't accept memory fields.
**Why it happens:** PromptContext interface lacks `similarCases` and `humanCorrections` fields.
**How to avoid:** Extend PromptContext interface with optional memory fields, then populate them in SkillRegistryService before calling draftGenerator.generate().
**Warning signs:** CaseMemory rows exist in DB but AI responses don't reference similar cases.

### Pitfall 6: Sensitive Data Interceptor Performance
**What goes wrong:** Applying the SensitiveDataInterceptor globally causes deep-recursion over large artifact payloads (artifact.content can be large JSON blobs).
**Why it happens:** Recursive object traversal on every response is O(n) in payload size.
**How to avoid:** Apply the interceptor only to complaint/execution controllers using `@UseInterceptors(SensitiveDataInterceptor)` at controller class level, not globally in main.ts.
**Warning signs:** Dashboard API responses become slow; deep objects like step_execution.output with many nested keys cause measurable latency.

### Pitfall 7: Admin Config CRUD without Migration
**What goes wrong:** Attempting to add new columns to Persona (e.g., a `tone` field) or SkillDefinition during Phase 7.
**Why it happens:** Phase 7 CONF requirements only require CRUD over existing schema — no new columns.
**How to avoid:** If any schema change is needed, it requires a new TypeORM migration file. The existing entities are complete for Phase 7 requirements. Don't modify entities without migrations (synchronize: false is enforced).
**Warning signs:** Application starts throwing "column X does not exist" on VPS after deploy.

## Code Examples

### Memory Context Injection into Prompt

```typescript
// Source: pattern from skill-registry.service.ts + prompt-builder.service.ts
// In SkillRegistryService.draftFinalResponse():
const embedding = await this.getEmbeddingForText(input.normalizedText);
const similarCases = await this.memoryRetrieval.findSimilarCases(
  embedding, tipologyId, 3
);
const humanCorrections = await this.memoryRetrieval.findSimilarCorrections(
  embedding, tipologyId, 3
);

// Extend PromptContext with memory fields
const ctx: PromptContext = {
  ...baseCtx,
  similarCases,      // new field in PromptContext
  humanCorrections,  // new field in PromptContext
};
const { system, user } = this.promptBuilder.buildDraftResponsePrompt(ctx);
```

### Observability Dashboard — Server Component Data Fetch

```typescript
// Source: Next.js App Router pattern (server component fetches, passes to client chart)
// In /admin/observability/page.tsx (Server Component)
export default async function ObservabilityPage() {
  const [latencyData, costData, hitlData] = await Promise.all([
    fetch(`${process.env.BACKEND_URL}/api/admin/observability/latency`).then(r => r.json()),
    fetch(`${process.env.BACKEND_URL}/api/admin/observability/cost`).then(r => r.json()),
    fetch(`${process.env.BACKEND_URL}/api/admin/observability/hitl-rate`).then(r => r.json()),
  ]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <LatencyBarChart data={latencyData} />      {/* 'use client' component */}
      <CostLineChart data={costData} />           {/* 'use client' component */}
      <ConformityScorePanel data={hitlData} />    {/* 'use client' component */}
    </div>
  );
}
```

### Admin Persona CRUD — Server Action Pattern

```typescript
// Source: React 19 useActionState pattern from Phase 6 (actions.ts)
'use server';
export async function createPersona(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const body = {
    name: formData.get('name') as string,
    formalityLevel: Number(formData.get('formalityLevel')),
    empathyLevel: Number(formData.get('empathyLevel')),
    assertivenessLevel: Number(formData.get('assertivenessLevel')),
    tipologyId: formData.get('tipologyId') as string | null,
    requiredExpressions: (formData.get('requiredExpressions') as string)
      .split('\n').filter(Boolean),
    forbiddenExpressions: (formData.get('forbiddenExpressions') as string)
      .split('\n').filter(Boolean),
  };
  const res = await apiFetch('/api/admin/personas', {
    method: 'POST', body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await res.text() };
  return { success: true };
}
```

### Trace Explorer — Full Execution Trace

```typescript
// Source: TypeORM pattern from execution.controller.ts
// GET /api/admin/observability/trace/:execId
async getExecutionTrace(execId: string) {
  return this.dataSource.query(
    `SELECT
       se.id, se."stepKey", se.status, se."startedAt", se."completedAt",
       se."durationMs", se."errorMessage",
       COALESCE(json_agg(lc) FILTER (WHERE lc.id IS NOT NULL), '[]') AS llm_calls,
       COALESCE(json_agg(a) FILTER (WHERE a.id IS NOT NULL), '[]') AS artifacts
     FROM step_execution se
     LEFT JOIN llm_call lc ON lc."stepExecutionId" = se.id
     LEFT JOIN artifact a ON a."stepExecutionId" = se.id
     WHERE se."ticketExecutionId" = $1
     GROUP BY se.id
     ORDER BY se."createdAt" ASC`,
    [execId],
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeORM repo.save() for vectors | Raw dataSource.query() + pgvector.toSql() | Phase 4 | All vector writes must use raw SQL |
| useFormState from react-dom | useActionState from react | Phase 6 / React 19 | All server actions use new hook |
| maxTokens in AI SDK | maxOutputTokens | Phase 6 / ai SDK v6 | 5 files already updated |
| EmbeddingModel<string> type | EmbeddingModel (no generic) | Phase 6 / ai SDK v6 | Use without type parameter |
| Recharts v2 | shadcn planning Recharts v3 upgrade (in progress) | March 2025 | Use v2.15.x via shadcn chart; v3 API may differ |

**Deprecated/outdated:**
- `useFormState` from react-dom: Replaced by `useActionState` from 'react' — all Phase 6 components already updated.
- `maxTokens` in AI SDK calls: Replaced by `maxOutputTokens` — already updated in Phase 6.
- `EmbeddingModel<string>`: Generic removed in AI SDK v6 — already updated in Phase 6.

## Open Questions

1. **recharts v3 vs v2 via shadcn**
   - What we know: shadcn currently ships recharts v2.15.x in its chart component; v3 upgrade is tracked in their GitHub
   - What's unclear: Whether we should install recharts v3 directly or use v2 via shadcn's chart
   - Recommendation: Use recharts v2.15.x via `npx shadcn@latest add chart` to stay consistent with shadcn; do not install v3 directly

2. **SensitiveDataInterceptor scope**
   - What we know: Global interceptor will deep-scan all response payloads including large artifact blobs
   - What's unclear: Whether VPS performance allows global application or requires scoping
   - Recommendation: Apply at controller class level on ExecutionController and ComplaintController; skip ObservabilityController since its data is already aggregated (no raw CPF/phone)

3. **HumanFeedbackMemory trigger timing**
   - What we know: Human review submission populates humanFinal on the human_diff artifact in Phase 6
   - What's unclear: Whether HumanFeedbackMemory insertion should happen synchronously on review submit or asynchronously
   - Recommendation: Insert synchronously in HumanReviewService.submitReview() after the HumanReview entity save — keeps it simple, no queue needed for PoC

4. **StyleMemory population**
   - What we know: StyleMemory entity exists with expressionType (approved/forbidden) and tipologyId
   - What's unclear: How StyleMemory gets populated — no skill currently writes to it
   - Recommendation: Populate StyleMemory from Persona entity's requiredExpressions/forbiddenExpressions on persona save/update via a background sync in AdminConfigService; MEM-03 (suggest approved patterns) can read StyleMemory when building persona context

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `/backend/src/modules/execucao/services/skill-registry.service.ts` — established vector insert, token tracking, and audit trail patterns
- Codebase inspection: `/backend/src/modules/memoria/entities/` — confirmed all 3 memory entities exist with correct fields
- Codebase inspection: `/backend/src/modules/auth/auth.module.ts` — confirmed RolesGuard as APP_GUARD
- Codebase inspection: `/backend/src/modules/ia/services/prompt-builder.service.ts` — confirmed PromptContext interface needs memory fields added
- Codebase inspection: `/frontend/package.json` — confirmed no charting library installed yet
- WebFetch: `https://github.com/recharts/recharts/releases` — confirmed latest stable is v3.8.0 (March 2025); shadcn still on v2
- WebFetch: `https://ui.shadcn.com/docs/components/chart` — confirmed shadcn chart uses recharts v2, planning v3 upgrade
- WebFetch: `https://ui.shadcn.com/docs/react-19` — confirmed `overrides.react-is` required for React 19 + recharts

### Secondary (MEDIUM confidence)
- WebSearch: recharts React 19 peer dependency — confirmed `react-is` override pattern, multiple sources agree
- WebSearch: NestJS interceptor for data masking — confirmed interceptor pattern with map() operator

### Tertiary (LOW confidence)
- WebSearch: NestJS observability patterns — found infrastructure-level tools (Prometheus, OpenTelemetry) not needed here; this phase uses custom SQL aggregations served directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by codebase inspection; recharts version confirmed via official GitHub releases
- Architecture: HIGH — all patterns derived from established codebase patterns (VectorSearchService, skill-registry, HumanReviewService)
- Pitfalls: HIGH — recharts/React 19 confirmed via official shadcn docs; other pitfalls confirmed by inspecting existing TypeORM synchronize:false and vector column patterns
- Memory injection gap: HIGH — PromptContext interface inspected directly, missing similarCases/humanCorrections fields confirmed

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable stack; recharts v3 shadcn migration is ongoing but won't land before this phase completes)
