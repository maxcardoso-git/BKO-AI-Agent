# Architecture — BKO AI Agent

High-level map of modules and the end-to-end `/processar` flow that an
operator drives. Pair with [GLOSSARY.md](./GLOSSARY.md) for the domain
vocabulary.

## System diagram

```
┌──────────────────┐        HTTPS (JWT)        ┌──────────────────────┐
│  BKO Console     │ ─────────────────────────►│  BKO Backend         │
│  (Next.js 16)    │                            │  (NestJS 11)         │
│  port 3000       │ ◄─────────────────────────│  port 3111           │
└──────────────────┘     JSON responses        └──────────┬───────────┘
                                                          │
                                       ┌──────────────────┼─────────────────┐
                                       │                  │                 │
                                       ▼                  ▼                 ▼
                              ┌──────────────┐   ┌────────────────┐  ┌──────────────┐
                              │  PostgreSQL  │   │  OpenAI API    │  │  Anthropic   │
                              │  17+pgvector │   │  (chat + embed)│  │  Claude      │
                              │  port 5433   │   └────────────────┘  └──────────────┘
                              └──────────────┘
```

Both LLM providers are reached via `@ai-sdk/*`. The provider+model+key for
each functionality (`CLASSIFICATION`, `GENERATION`, `ANALYSIS`, `EXTRACTION`,
`REVIEW`) is configured in the `llm_model_config` table and resolved by
`model-selector.service`.

## Modules

| Module | Responsibility | Key controllers / services |
|---|---|---|
| `auth` | Login, JWT issuance, opaque token exchange, RolesGuard | `auth.controller`, `jwt.strategy`, `roles.guard` |
| `operacao` | Complaints, locks, users, access tokens, Turbina import, template override per ticket | `complaint`, `ticket-lock`, `admin-users`, `turbina-import`, `template-override` |
| `execucao` | Ticket execution orchestration, analytics, observability, human review | `ticket-execution`, `analytics`, `observability`, `human-review`, `admin-feedback`, `admin-audit` |
| `ia` | LLM agents and prompt building | `smart-note`, `template-fields-extractor`, `mandatory-field-extractor.agent`, `prompt-builder`, `draft-generator.agent`, `compliance-evaluator.agent`, `final-response-composer.agent`, `complaint-parsing.agent`, `model-selector`, `token-usage-tracker` |
| `base-de-conhecimento` | KB ingestion, embedding generation, vector search, template resolver | `vector-search`, `document-ingestion`, `template-resolver`, `kb-manager` |
| `memoria` | RAG over past human corrections (learning loop) | `memory-retrieval`, `memory-feedback`, `human-feedback-memory` entity |
| `regulatorio` | ANATEL response templates, mandatory information rules | `response-template`, `mandatory-info-rule`, `admin-config` |
| `orquestracao` | External resource registry (LLM endpoints, secrets), step designer | `resource` (with masking), `steps-designer` |

## /processar end-to-end flow

The single most important flow in the system. An operator picks a ticket
and the IA generates a draft answer that the operator reviews.

```
                                ┌─────────────────────────────────────┐
  Operator clicks link ────────►│  /processar?token=XYZ (frontend)    │
  from Turbina (or logs in)     └────────────┬────────────────────────┘
                                             │
              POST /api/auth/token-exchange  │
              ◄──── { access_token, user }   ▼
                                  ┌──────────────────────┐
                                  │  AuthController      │ ── access-token.service
                                  │  → AuthService       │     validateToken()
                                  └──────────┬───────────┘
                                             │ JWT in localStorage
                                             ▼
              Operator types protocol  ┌──────────────────────┐
              ───────────────────────► │  GET complaints/      │
                                       │      by-protocol      │
                                       └──────────┬───────────┘
                                                  │ complaint.id
                                                  ▼
              ┌────────────────────────────────────────────────────────────────┐
              │ Parallel fetches once complaint is found:                       │
              │   GET /complaints/:id              (full record)                │
              │   GET /admin/analytics/tickets/:id (drill-down — OPERATOR ok)   │
              │   POST /complaints/:id/lock        (acquire ticket-lock)        │
              │   POST /complaints/:id/sentiment-preview (cached IA artifact)   │
              │   POST /complaints/:id/extract-mandatory-fields  ← LLM pre-fill │
              │       MandatoryFieldExtractorAgent reads rawText, suggests      │
              │       values for the 6 global mandatory_info_rule fields.       │
              │       Frontend pre-populates green NoteForm with 💡 IA badge.   │
              │       hasSignal=false → leaves field empty (operator types).    │
              └────────────────────────────┬───────────────────────────────────┘
                                           │
                                           ▼
                ┌─────────────────────────────────────────────────────┐
                │ Operator reviews/edits the NoteForm                 │
                │ Hits "Processar"                                    │
                └────────────────────┬────────────────────────────────┘
                                     │
              POST /complaints/:id/compliance-recheck  ← pre-flight gate
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
              all 6 fields filled         any field empty
                      │                             │
                      ▼                             ▼
   POST /complaints/:id/executions/start    Red modal "Voltar e preencher"
                      │                     (HARD BLOCK — no escape hatch)
                                           │
                                           ▼
                ┌────────────────────────────────────────────────────────┐
                │  TicketExecutionService.startExecution(complaintId)    │
                │  1. Creates TicketExecution + StepExecution rows       │
                │  2. Resolves capability → ordered Steps                │
                │  3. Dispatches each step's skill via SkillRegistry     │
                └─────────────────┬──────────────────────────────────────┘
                                  │
              ┌───────────────────┼──────────────────────────────┐
              ▼                   ▼                              ▼
   ┌───────────────────┐ ┌───────────────────┐         ┌──────────────────────┐
   │ ComplaintParsing  │ │ DraftGenerator    │   …     │ FinalResponseComposer│
   │   .agent          │ │   .agent          │         │   .agent             │
   │ extracts entities │ │ uses persona +    │         │ assembles HTML +     │
   │ (cliente, fatura, │ │ template + memory │         │ runs ComplianceEval  │
   │  contas, etc.)    │ │ to draft response │         │   .agent at the end  │
   └─────────┬─────────┘ └─────────┬─────────┘         └──────────┬───────────┘
             └───── stores Artifact rows ─┐                       │
                                          ▼                       ▼
                                ┌────────────────────────────────────┐
                                │   complaint.statusGeral updates    │
                                │   memory-retrieval surfaces past   │
                                │   human corrections of this        │
                                │   tipology + situation             │
                                └────────────────────────────────────┘
                                           │
                                           ▼
                               Operator opens /validar
                          GET /complaints/:id/executions/...
                                           │
            ┌──────────────────────────────┴────────────────────────────┐
            ▼                                                           ▼
   ┌──────────────────────┐                                ┌────────────────────────┐
   │ Smart Note actions   │     POST /ai/smart-note         │ Approve / Correct /    │
   │ (Sintetizar /        │ ────────────────────────────►   │ Reject                 │
   │  Reescrever / etc.)  │                                 │  POST /human-reviews   │
   └─────────┬────────────┘                                 │  POST persona-check    │
             │                                              │   (blocks on persona   │
             │ POST /persona-check before approve            │    violations)         │
             └──────────────────────────────────────────────►└────────────────────────┘
                                                                       │
                                                                       ▼
                                            ┌──────────────────────────────────────┐
                                            │ HumanFeedbackMemory rows captured    │
                                            │  with embedding — feed next ticket's │
                                            │  draft via vector-search             │
                                            └──────────────────────────────────────┘
```

### Key invariants

- **Lock-or-bust:** every `/processar` action against a complaint must hold
  a fresh `ticket-lock`. Lock TTL is renewed by the frontend every ~30s.
  See `ProcessarClient.tsx` `lock/renew` heartbeat.
- **Idempotent restart:** `executions/start` always creates a new
  `TicketExecution`. Old executions are kept for audit (`/observability/trace`).
- **Persona enforcement is hard:** smart-note's `persona-check` returns
  `{ forbidden, missing }`. The frontend blocks "Aprovar" if either is
  non-empty. The persona resolver tries tipology-specific first, then global.
- **Memory matters:** `vector-search` on `humanFeedbackMemory` with
  `feedbackType='iqi_substitution'` + `tipologyId` + cosine ≥ 0.85 surfaces
  past corrections. Tag any synthesized result with `matchType='memory_learned'`
  so the UI can show "aprendido da memória".

## Auth flow

Two entry points, one outcome (JWT in localStorage):

### A) Password login (admins, supervisors)

```
POST /api/auth/login        { email, password }
   ↓ AuthService.validateUser → bcrypt.compare
   ↓ jwtService.sign({ sub, email, role })
   ← { access_token, user }
```

### B) Opaque token (operators arriving from Turbina)

```
POST /api/auth/token-exchange    { token }
   ↓ AccessTokenService.validateToken → table lookup + expiry
   ↓ AuthService.login(user)
   ← { access_token, user }
```

JWT lifetime: 7 days. Payload: `{ sub: userId, email, role: 'operator'|'supervisor'|'admin' }`.
Role is **lowercase** in the JWT and is matched lowercase by RolesGuard.

## LLM resolution chain

```
Request needs an LLM for, say, GENERATION
  ↓
ModelSelectorService.getActiveConfigForFunctionality('GENERATION')
  ↓ findOne({ functionalityType: 'GENERATION', isActive: true }, relations: ['resource'])
  ↓
resolveApiKey(config):
  if config.resource?.apiKeyValue  → return it
  if config.resource?.bearerToken  → return it
  else                             → return env('OPENAI_API_KEY')
  ↓
ai-sdk(provider, model, apiKey).generateText({ … })
```

Embeddings have their own chain (`vector-search.resolveEmbeddingConfig`) but
follow the same priority order. Both bypass DI to avoid circular deps —
they query the DB directly via the same `DataSource` pool.

## Prompt invariants (anti-hallucination)

These rules are enforced in code (system prompts) AND configuration (model
temperatures). They protect the regulatory contract — wrong dates / fake
prazos in production drafts become real ANATEL fines.

| Layer | Where | What |
|---|---|---|
| Temperature | `llm_model_config.composicao.temperature` | **0.2** (was 0.7 until 2026-06-04). Draft generator + composer both read it. Raise knowingly. |
| Preamble | `prompt-builder.buildDraftResponsePrompt` first lines | "REGRAS ABSOLUTAS" block bans inventing dates, valores, prazos, telefones, ouvidoria, ações tomadas — comes BEFORE persona, template, mandatory fields, KB. |
| Defaults | placeholder legend | **Removed entirely.** Old prompt had "padrão: 5 a 10 dias úteis" — literal source of one production hallucination. Don't reintroduce sample fillers. |
| Missing data | when template placeholder lacks source | LLM writes `[dado pendente]`, never plausible value. Operator fills in /validar. |
| Composer | `final-response-composer.agent` system prompt | Same REGRAS ABSOLUTAS preamble (second invention vector). |
| Extractor | `mandatory-field-extractor.agent` | Uses temp 0.1 + strict `{ value, hasSignal }` schema. `hasSignal=false` → field stays empty (operator types). |
| Operator data | `prompt-builder` PIPE-03 block | "USE estes dados como base factual. NAO invente valores nem datas que contradigam a nota." Parameters flow flat (legacy `dynamicFields` wrapping is auto-unwrapped). |

Order matters in the system prompt: more recent concrete instructions win.
That's why REGRAS ABSOLUTAS goes FIRST and persona instructions come AFTER
template instructions — a stronger "no invent" loses to a weaker but more
recent default if you flip the order.

## Database highlights

| Table | Purpose |
|---|---|
| `user`, `access_token` | Auth subjects + opaque token store |
| `complaint` | One ANATEL ticket. `statusGeral` drives queue state. |
| `ticket_lock` | Exclusive operator hold during processing |
| `ticket_execution`, `step_execution`, `artifact` | Audit trail of every IA run |
| `response_template` | IQI templates (handlebars-like `[Cliente]` markers) |
| `mandatory_info_rule` | ANATEL-mandated fields per tipology/situation |
| `persona` | Required + forbidden expressions per tipology |
| `human_feedback_memory` | Past corrections, embedded for RAG |
| `kb_document`, `kb_chunk` | Knowledge base ingestion, embedded for RAG |
| `llm_model_config`, `resource` | LLM provider/model/key resolution |
| `turbina_import_preset` | Operator-saved filters for Turbina import |

The full schema is captured in the dump shipped via `BKO-Deploy/`. New
schema changes go through `npm run migration:generate -- src/database/migrations/$NAME`.
