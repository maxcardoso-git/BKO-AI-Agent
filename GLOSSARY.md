# Glossary — BKO AI Agent

Domain and project vocabulary. If a term in the code doesn't appear here,
add it the moment you learn it — the next dev will thank you.

## Domain

**BKO** — *Back Office*. The operations team that drafts and dispatches
responses to regulatory consumer complaints. The "BKO AI Agent" replaces
the manual drafting step with an LLM-assisted pipeline that the BKO
operator approves or corrects.

**ANATEL** — Brazilian National Telecommunications Agency. Receives consumer
complaints against telecom operators and forwards them via standardized
protocols. Responses must meet content + format requirements within strict
SLAs. Non-compliance generates fines.

**Reclamação / Complaint** — one ANATEL ticket. Has a `protocolo` (visible
to the consumer), a `tipology`, a `situation`, optional `consumerNote`, and
a deadline. Mapped to the `complaint` table.

**Protocolo** — the human-readable identifier ANATEL assigns to each
complaint (e.g., `2026-001234567`). The operator pastes this into /processar
to load the ticket.

**Tipologia / Tipology** — the category of the complaint per ANATEL's
taxonomy (e.g., *Cobrança Indevida*, *Reparo Não Atendido*, *Cancelamento*).
Drives which template, persona, and mandatory-info rules apply.

**Situação / Situation** — sub-classifier under a tipology. A tipology like
*Cobrança Indevida* has situations like *Cliente já pagou*, *Cliente nunca foi
informado do valor*, *Plano alterado sem autorização*. Combined with tipology
to select a `response_template`.

**IQI** — *Instrução de Qualificação Interna*. The official text template
the BKO uses to compose a response. Has placeholders like `[Cliente]`,
`[ValorContestado]`, `[DataPagamento]` that the IA fills from the complaint.
Stored as `response_template` rows.

**Persona** — the tone-and-style ruleset for a given tipology. Holds
`requiredExpressions` (must appear in the answer) and `forbiddenExpressions`
(must NOT appear). Approve/Correct is **blocked** if any rule is violated —
see `smart-note.service.checkPersona()`.

**Smart Note** — operator-facing IA action that rewrites/improves a text
block (sintetizar, reescrever, simplificar, formalizar). Always runs through
persona-check after generation.

**Turbina** — the external system that aggregates ANATEL complaints and
forwards them with operator-deep-links. When an operator clicks a Turbina
link they land on `/processar?token=XYZ` and we exchange the opaque token
for a JWT. Bulk import of Turbina spreadsheets lives under `/turbina`.

**TMT** — *Tempo Médio de Tratamento*. Average handling time per ticket,
reported in `/tmt`. Comes from `timing_event` rows the backend emits on
specific UX events.

**Mediação / Mediation** — ANATEL phase between filed complaint and final
resolution. Some templates only apply in mediation; the regulatory module
tracks the flags.

**Dossiê / Dossier** — the bundle of artifacts (complaint + draft + IA
analysis + operator notes + final response) generated during one execution.
Visible in `/admin/analises/[id]` drill-down.

**TIM, Vivo, Claro, Oi** — the major Brazilian telecom operators. The
product is designed to be multi-tenant but the current deployment serves
**one tenant at a time** (configured in `resource` rows + `.env`). No
per-tenant DB partitioning yet.

## Project

**Resource** — a row in the `resource` table representing an external
endpoint or credential (LLM API, database, webhook). Secrets are masked
on read; `apiKeyValue` etc. only ever leave the DB internally. Managed
under `/recursos`.

**Functionality (LLM)** — the role an LLM is playing. Discrete values:
`CLASSIFICATION`, `GENERATION`, `ANALYSIS`, `EXTRACTION`, `REVIEW`. Each
has at most one active `llm_model_config` at any time, swappable from
`/llm-config`.

**Capability + Step** — `steps-designer` lets admins define ordered Step
arrays that group into a Capability version. Each Step references a Skill.
`SkillRegistry` runs them when an execution starts.

**Skill** — a named unit of work the IA can dispatch (e.g.,
`parse-complaint`, `generate-draft`, `evaluate-compliance`). `Skill` defs
live in `skill_definition`; concrete handlers in `ia/services/*.agent.ts`.

**Artifact** — anything an execution produces (parsed entities, draft HTML,
compliance verdict, sentiment summary). Stored as JSON in `artifact` with
a content type tag (`PARSED_COMPLAINT`, `DRAFT_RESPONSE`, `SENTIMENT`,
`COMPLIANCE_REPORT`, …).

**Execution / Step Execution** — one run of a Capability against one
complaint. `ticket_execution` holds the run-level state; `step_execution`
holds per-step status + timing + artifact pointers. Visible in
`/observability/trace/[execId]`.

**Memory Learning Loop / IQI Substitution** — when an operator *corrects*
an IA draft, the corrected text is embedded (text-embedding-3-small) and
stored as a `human_feedback_memory` row with `feedbackType='iqi_substitution'`
and the tipology context. Future drafts for the same tipology RAG-retrieve
these via `vector-search` (cosine ≥ 0.85) and graft the operator's wording in.

**Mandatory Info Rule** — ANATEL-mandated fields that MUST be answered for
a given tipology+situation (e.g., "informar valor estornado e data"). Drives
the green "Obrigatórios da Anatel" group in the operator's NoteForm and is
checked by `ComplianceEvaluator.agent`.

**Lock** — a `ticket_lock` row that one operator holds while processing a
complaint. Prevents two operators from drafting in parallel. Auto-renew
heartbeat lives in `ProcessarClient.tsx`. Admins can break locks from
`/admin/locks`.

**Smart Note action variants** — `synthesize`, `rewrite`, `simplify`,
`formalize`, `summarize`. The action label is the literal string used in
the `/api/ai/smart-note` request body.

**Persona check** — distinct from "Smart Note" itself. Just a NFD-normalized
substring scan over the proposed answer to verify it contains every
`requiredExpressions` entry and none of `forbiddenExpressions`. Runs on
every approve attempt. Returns `{ persona, forbidden, missing }`.

**Template Override** — operators sometimes need to use a different IQI
than the one auto-resolved by tipology+situation. The
`template-override.service` lets them pick another template for **this
specific complaint**. Stored as `complaint.templateOverrideId`. The
override embedding feeds future tipology-level suggestions.

## Roles (auth)

**OPERATOR** — default role. Can process tickets in /processar, run
smart-note, approve/correct/reject drafts, view read-only analytics for
their own tickets. Cannot configure templates, personas, users.

**SUPERVISOR** — adds visibility into `/admin/analises`, `/admin/locks`,
`/observability`, `/dashboard`, `/tmt`. Can break locks. Cannot edit
configuration tables.

**ADMIN** — full access. Manages users (`/admin/users`), tokens, templates,
personas, resources (LLM keys), skills, steps, KB, regulatory rules. Has
the destructive `/admin/reset` button.

> Reminder: the rule is **fluxo de trabalho de quem é, role é dele**.
> If a function appears in the operator's path, the operator role must be
> in the `@Roles(...)` list. Admin-only is for setup tables and destructive
> actions. See [HANDOFF.md](./HANDOFF.md) for an incident where this
> reminder mattered.

## Acronyms cheatsheet

| Acronym | Stands for | In this project |
|---|---|---|
| BKO | Back Office | The whole product |
| ANATEL | Agência Nacional de Telecomunicações | Regulator we respond to |
| IQI | Instrução de Qualificação Interna | Response template |
| TMT | Tempo Médio de Tratamento | Handling time KPI |
| HITL | Human-In-The-Loop | Operator approve/correct step |
| KB | Knowledge Base | Vectorized docs for RAG |
| RAG | Retrieval-Augmented Generation | Memory + KB lookups before drafting |
| NLP | Natural Language Processing | Skill subtype |
| DTO | Data Transfer Object | NestJS request/response shapes |
