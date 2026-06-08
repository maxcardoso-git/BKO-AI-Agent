# Handoff — BKO AI Agent

Snapshot of the project as of **2026-06-08**. Read this once; refresh by
running `git log` after.

## TL;DR

- Backend production-stable on the reference VPS (`72.61.52.70`,
  `pm2 → bko-backend`, port 3111, **cwd `/opt/bko-agent/backend`**).
- Frontend production-stable on the same VPS (`pm2 → bko-console`,
  port 3000, **cwd `/root/EngDB/BKOConsole`**).
- Both GitHub repos are the source of truth and match the VPS.
- Deploy package (DB dump + env templates + restore script) delivered
  out-of-band as `BKO-Deploy/`. Latest dump: `bkoagent_2026-06-03_2203.dump`
  — zero tickets, schema complete, persona briefs populated, LLM configs
  tuned for safety.
- Single tenant, single DB. Multi-tenant not implemented.
- **Anti-hallucination posture is now a hard product property** — see
  [Anti-hallucination invariants](#anti-hallucination-invariants) before
  touching prompts or LLM temps.

## What works

### Operator flow (`/processar`)
- Token-exchange entry from Turbina
- Search by `protocolo`
- Per-ticket drill-down (analytics summary)
- Lock acquisition + 30s heartbeat
- **NoteForm: pre-flight LLM extraction of ANATEL mandatory fields** —
  operator opens a ticket and the IA (gpt-4o-mini, low temp) reads the
  complaint text and pre-fills suggested values for the green obrigatórios.
  Operator reviews and edits. Suggested values carry a violet `💡 IA —
  verifique` badge that clears on edit. Never invents — empty when source
  silent.
- **NoteForm: ticket prefill** — `numero_protocolo`, `cpf_reclamante`,
  `nome_reclamante`, telefones, endereço, `data_resolucao` (defaults to
  today) pre-filled from the ingested ticket data.
- **Processar button: hard-block compliance gate** — pre-flight call to
  `/compliance-recheck` before firing `/executions/start`. If any
  mandatory field is empty, opens a red modal listing pendentes;
  single button "Voltar e preencher". No "Processar mesmo assim" — the
  pipeline never runs with pendência.
- IA pipeline: parse → draft → compliance → composer
- **Rascunho da Resposta header**: pill badges showing Template used,
  Tipologia (with name), and Precisão (LLM confidence %) so the operator
  understands what the IA picked before editing.
- **Smart Note (7 actions)**: Elaborar, Resumir, Corrigir, Reformular,
  Formalizar, **Empatizar**, **Simplificar**. Each has a distinct lucide
  icon + tooltip explaining its prompt. Textarea is resizable
  (min 120px, max 480px). "Adicionar à Nota do Operador" with
  `ArrowDownToLine` icon makes the destination explicit.
- **Persona check + footer confirmation dialogs**:
  - **Aprovar** opens a confirmation. If compliance is OK → green dialog
    "marca como final, segue para envio". If compliance < 100% → amber
    warning listing pendentes, can still proceed but explicit.
  - **Corrigir** opens an indigo dialog explaining "edit goes to memory
    for training, NOT sent to customer". Persona check **only blocks
    Aprovar** — Corrigir always saves.
  - **Reprovar** opens RejectionModal with mandatory reason ≥10 chars.
- Persona check (forbidden + required expressions, NFD-normalized substring)
- Memory learning loop: corrections embedded and surfaced in future drafts
- Template Override (operator picks a different IQI for one complaint)
- Rich-text rendering of "Resposta enviada ao cliente"

### Admin surfaces
- `/admin/users` — CRUD (added 2026-06-01)
- `/admin/tokens` — opaque token issuance + revoke
- `/admin/locks` — view and break ticket locks
- `/admin/analises` — per-ticket analytics list + drill-down
- `/admin/reset` — destructive base wipe (confirm twice)
- `/admin/feedback` — human feedback memory
- `/admin/audit/timings` — TMT and step latency
- `/recursos` — resource registry with secret masking + edit-with-eye-toggle
- `/llm-config` — LLM model config per functionality (with apiKey from `resource`)
- `/personas` — CRUD + **Clone button**: clones a persona keeping name(+ "
  (cópia)"), tone levels, required/forbidden expressions and the free-text
  `instructions` brief; clears `tipologyId` so the admin picks a new
  tipology. Saves typing the 2000+ char brief once per tipologia.
- `/personas` form: **textarea "Instruções para a IA"** — free-text brief
  that ships into the LLM system prompt for draft generation AND smart-note,
  scoped to the persona's tipology with global fallback. Each persona can
  steer the IA differently per tipology.
- `/templates`, `/skills`, `/steps`, `/kb`, `/regulatory`, `/memory`
- `/turbina` — bulk import with operator-saved filter presets

### Infrastructure
- LLM apiKey lives in DB (`resource.apiKeyValue`), not `.env` — env is
  fallback only. `OPENAI_API_KEY` is empty on the VPS `.env`.
- Embeddings: OpenAI `text-embedding-3-small`, 1536 dims, pgvector.
- Secret masking is end-to-end: backend returns `first8***last4` + `has*` flags.

### Turbina bulk import + tipology routing (2026-06-08)
- **In-batch dedup + collision-tolerant insert** (`turbina-import.service.ts`):
  the Turbina export repeats a protocol across rows (reopened tickets / multiple
  tasks). With `UNIQUE(protocolNumber)` and no in-batch dedup, two rows sharing
  a protocol aborted the whole `save()` chunk and **silently dropped ~1393 valid
  rows behind only 7 generic errors**. Now: dedup by protocol (keep latest
  `Data de Cadastro`), insert chunk-by-chunk with row-by-row fallback, and a
  `deduped` counter in `TurbinaImportResult`.
- **Modalidade → tipology alias** (`MODALIDADE_TIPOLOGY_ALIAS`): the importer
  matched Modalidade→tipology by **exact label**, so verbose ANATEL Modalidades
  fell into the "Outros" fallback — **49% of complaints (1259/2587)** got the
  generic default IQI/persona instead of a specific one. The alias map routes
  them. Product-confirmed mapping:

  | Modalidade | → tipology key |
  |---|---|
  | Plano de serviços, Oferta, Bônus, Promoções… | `plano_servicos` |
  | Qualidade, Funcionamento e Reparo / Instalação ou Ativação… | `qualidade` |
  | Bloqueio, desbloqueio ou Suspensão / Ressarcimento / Crédito Pré-pago | `cobranca` |
  | Dados cadastrais ou número da linha | `atendimento` |

- **One-time data re-map** already run on the reference VPS DB (1259 rows,
  "Outros" → 0). For any other environment (e.g. a fresh dump) the SQL is
  versioned at **`backend/scripts/remap-modalidade-tipologia.sql`** (idempotent,
  preview + transaction + verify). No schema change → **no migration**.

### Templates IQI admin screen (2026-06-08)
- `/templates` resolves `tipologyId → name` (editor badge + list cards) via
  `useTipologies()`, and adds a **tipologia filter dropdown** combined with the
  search (AND). Options limited to tipologies that actually have templates.

### Message generation uses BOTH persona AND IQI template (verified 2026-06-08)
- `buildDraftResponsePrompt` injects, in order: REGRAS ABSOLUTAS → persona tone
  + `instructions` (style/additions) → **IQI `templateContent` as the message
  structure** → mandatory fields → operator note → KB/memory. So **persona =
  tone/additions, IQI template = format/skeleton**. Because the template comes
  *after* the persona, structural instructions inside a persona would lose to
  the template — **keep personas to tone/style/expressions only**. Coverage
  matters: a complaint whose tipology has no template falls back to a default
  template (3 exist), which is why the routing fix above (no more "Outros") is
  what makes the specific IQIs actually reach the draft.

## Anti-hallucination invariants

Treat these as **product invariants**, not opinions. Regulatory writing has
no creative freedom — wrong dates / fake refund prazos / made-up ouvidoria
phones become fines.

1. **`composicao` temperature MUST stay at 0.2** (or lower). Stored in
   `llm_model_config`, visible/editable in `/llm-config`. Was 0.7 until
   2026-06-04 and produced one demonstrable hallucination after another.
   Raise only with a written justification AND a test that catches
   regressions.

2. **`buildDraftResponsePrompt` starts with a "REGRAS ABSOLUTAS" block**
   that bans inventing dates, valores, prazos, telefones, ouvidoria,
   ações tomadas. Order matters — that block must come **before** persona,
   template, mandatory-fields, KB context. Models follow the more recent
   concrete instruction; a "no invent" persona right next to a "default:
   5 a 10 dias úteis" template legend loses to the legend every time.

3. **No defaults in placeholder legends.** The prompt-builder used to
   declare `{{prazo_estorno}} = padrao: 5 a 10 dias uteis` and
   `{{status_cobranca}} = "confirmada e o estorno sera processado" ou
   "contestada"`. Removed. **Don't reintroduce sample fillers in any
   prompt** — they leak into production drafts as "facts".

4. **When a placeholder has no source data → `[dado pendente]`**, never
   a plausible value. The prompt enforces this and the operator gets to
   fix it in /validar before approving.

5. **`final-response-composer.agent` carries the same anti-hallucination
   preamble** because it reshapes the draft based on compliance feedback —
   and was caught inventing too.

6. **`MandatoryFieldExtractorAgent`** (the new pre-flight LLM extraction
   on `/processar`) uses temp 0.1 and a strict-no-invent schema where each
   field returns `{ value, hasSignal }`. When `hasSignal=false` the field
   stays empty in the NoteForm — the operator types. Never auto-fill
   with `hasSignal=false` value.

7. **The operator note's `parameters` flow into the prompt as
   "USE estes dados como base factual"** (PIPE-03 in
   `prompt-builder.service.ts`). When debugging "the IA ignored the
   operator's data", first confirm the parameters key spelling matches
   the template/rule field name — `data_resolucao` not `dataResolucao`.

## What's WIP / known issues

### IA broken for OPERATOR in a sister environment (2026-06-02)
Another deploy of this product (not the reference VPS) processes tickets
incorrectly for OPERATOR role while ADMIN works. Likely cause: older
backend where an endpoint in the operator's flow is still gated
`@Roles(ADMIN)` only. Top candidates: `/admin/analytics/tickets/:id`,
`/complaints/:id/sentiment-preview`, `/complaints/:id/executions/start`.
**The current backend (commit `c305bed`+) has these correctly opened to
OPERATOR.** Redeploying GitHub `main` to that environment should fix it.

### EventsGateway is registered but not used
`src/events.gateway.ts` is a WS scaffold (handleConnection + emit helpers)
that no frontend consumes yet. Kept for future use; package deps declared
(`@nestjs/websockets`, `@nestjs/platform-socket.io`).

### Old `webhook.*` + `ingest.*` + `user.controller` files
Were on the VPS as dead code (not registered in any module). Deleted on
2026-06-01 during the VPS↔Git reconciliation. If a webhook/ingest feature
gets requested again, the commit history
(`git log --diff-filter=D --oneline`) points to the prior shape.

### iCloud + git push pitfall (macOS local dev)
The original developer's `~/Documents/EngDB` is iCloud-synced, and that
breaks `git pack-objects` (`mmap: Operation timed out`) for the frontend
repo — and intermittently for `git fetch`. Workaround used throughout
2026-06-01..04: do the commit on the VPS (`/tmp/BKO-Console-fresh`),
push from there with a PAT, reset the URL. **If you ever hit this, move
the working copy out of iCloud Drive** (e.g. `~/Code/BKO-Console`).

### Reference VPS path layout (read before deploying!)

On `72.61.52.70` the canonical paths the running processes use are:

| Service | pm2 name | exec cwd | Where to deploy code |
|---|---|---|---|
| Backend | `bko-backend` | `/opt/bko-agent/backend` | here, **not** /root |
| Frontend | `bko-console` | `/root/EngDB/BKOConsole` | here |

The second backend clone at `/root/EngDB/BKOAgent/backend/` was renamed
to `/root/EngDB/BKOAgent.DEPRECATED/` on 2026-06-03 to remove the
"deploy to the wrong path" trap that ate several days of supposed
production deploys. **Do not resurrect it.**

**Always verify before assuming a deploy worked:**

```bash
ssh root@72.61.52.70
pm2 describe bko-backend | grep 'exec cwd'   # must show /opt/bko-agent/backend
pm2 describe bko-console | grep 'exec cwd'   # must show /root/EngDB/BKOConsole
```

The migration runner connects to Postgres directly (port 5433), so
`npm run migration:run` from **any** path that has the migration file
applies it to the live DB — that's how a previous session ended up with
a schema migration applied (`persona.instructions`) but the entity update
only present in the wrong clone, causing 500 `EntityPropertyNotFoundError`.
**If you add a column, deploy code + migration to the running path, not
just one of them.**

### Backend restart recompiles from source (slow) — 2026-06-08

`bko-backend` is started via `pm2 → npm start → nest start`, and
`nest-cli.json` has `deleteOutDir: true`. So **every `pm2 restart bko-backend`
deletes `dist/` and recompiles the whole project from `src/` on boot** — on the
loaded reference VPS this can take **anywhere from ~25s to ~11min** before the
port (3111) comes back. It is not hung; watch with:

```bash
ss -ltn | grep :3111            # nothing until the compile finishes
ps -o %cpu,etime -p $(pgrep -f 'node.*nest start')   # high CPU = still compiling
```

A deploy of a `src/*.ts` change is: `scp` the file → `npm run build` (optional,
`nest start` rebuilds anyway) → `pm2 restart bko-backend` → wait for 3111.
**Recommended cleanup (not yet done):** switch pm2 to run the prebuilt dist
(`node dist/src/main.js`, `deleteOutDir` off) to make restarts take seconds.

## Recent significant commits

Backend (`maxcardoso-git/BKO-AI-Agent`):
- `240e1a7` — chore(scripts): idempotent re-map SQL for Modalidade → tipology
- `98273cc` — feat(turbina-import): alias verbose ANATEL Modalidade → internal tipology
- `ff3c14d` — fix(turbina-import): dedup protocols in-batch + collision-tolerant insert
- `c305bed` — fix(prompts): close hallucination paths in draft generator + composer
- `d24e003` — feat(ia): pre-flight extraction of mandatory ANATEL fields on /processar
- `3201ed0` — feat(smart-note): add Empatizar + Simplificar actions
- `158ae78` — feat(persona): clone endpoint POST /admin/personas/:id/clone
- `6dc92e2` — docs(handoff): canonical VPS paths + the /opt vs /root deploy pitfall
- `a7840e5` — fix(human-review): persist compliance score the operator saw at decision time
- `d4e2ab8` — feat(persona): free-text `instructions` field for LLM steering
- `25760bc` — docs: handoff package (CLAUDE/ARCHITECTURE/GLOSSARY/HANDOFF)
- `8084438` — feat: admin users + resource secret masking + websocket deps
- `4d2592f` — refactor: resolve LLM API key from DB with .env fallback

Frontend (`maxcardoso-git/BKO-Console`):
- `0e7ad07` — feat(templates): show tipologia name instead of UUID + tipologia filter
- `62245c4` — fix(processar): preserve ticket prefill through IA extract + hard-block on pendências
- `80c3f52` — feat(processar): IA auto-fills mandatory fields + compliance gate on Processar
- `c4b73d9` — feat(validar): UX overhaul of Smart Note + footer confirmations + draft header
- `9db3477` — feat(personas): clone button on each row
- `8751e5d` — feat(personas): textarea for free-text LLM instructions
- `4885d66` — fix(validar): persona-check only blocks Aprovar, not Corrigir
- `876c934` — docs: CLAUDE.md handoff
- `b2098b9` — initial snapshot matching VPS production

> **Mirror repo `TiagoMacedoso/bko` (2026-06-08):** a third party runs this
> product from a **monorepo** `TiagoMacedoso/bko` (`BKO-AI-Agent/backend` +
> `BKO-Console` + `db-dumps/` + `docker-compose.yml`). The Turbina dedup,
> the Modalidade alias, the templates-screen change and the re-map SQL were
> mirrored there (HEAD `eacf83a`). When you ship a backend/frontend fix that
> they need, push the same change into that monorepo's subfolders too. They
> deploy from a separate DB, so the re-map SQL must be run on their side.

> **Note 2026-06-03:** Commits between `8084438` and `a7840e5` were pushed
> to GitHub during March–June but **never actually ran on the reference VPS**
> — the deploy target during that period was the stale
> `/root/EngDB/BKOAgent/backend/` clone, while pm2 was running from
> `/opt/bko-agent/backend/`. Fixed by full rsync to `/opt/` + rebuild +
> restart on 2026-06-03. Operator-visible behavior caught up to the Git
> log only on that date.

## Production reference

| Service | Host | Port | pm2 name | Path |
|---|---|---|---|---|
| Postgres (pgvector pg17) | `72.61.52.70` (Docker) | 5433 | container `bkoagent-postgres-1` | volume `bkoagent_pgdata` |
| Backend | `72.61.52.70` | 3111 | `bko-backend` | `/opt/bko-agent/backend` |
| Frontend | `72.61.52.70` | 3000 | `bko-console` | `/root/EngDB/BKOConsole` |

```bash
ssh root@72.61.52.70
pm2 list                                  # see processes
pm2 logs bko-backend --lines 100
pm2 logs bko-backend --lines 30 --err     # error log only
pm2 restart bko-backend --update-env
docker exec -it bkoagent-postgres-1 psql -U bko -d bkoagent
```

## LLM configuration in production

Stored in `llm_model_config`. Editable from `/llm-config` UI.

| functionalityType | provider | model | temperature | Purpose |
|---|---|---|---|---|
| `classificacao` | openai | gpt-4o-mini | **0.1** | Tipologia extraction, mandatory field extraction (low — structured output) |
| `composicao` | openai | gpt-4o | **0.2** | Draft generator + final composer (**MUST stay low** — see invariants) |
| `avaliacao` | openai | gpt-4o-mini | **0.2** | Compliance evaluation |
| `embeddings` | openai | text-embedding-3-small | 0 | KB + memory embedding |

When restoring on a fresh server: the dump
`bkoagent_2026-06-03_2203.dump` already contains these values. If you
restore from an older dump, **manually verify `composicao.temperature = 0.2`**
before going live.

## How to deploy on a fresh server

Use `BKO-Deploy/DEPLOY.md` (delivered separately). It walks through:
clone repos → docker compose up postgres → restore dump → write `.env`
→ build + pm2 start.

**Verify after deploy:**
1. `composicao.temperature` is `0.2` in `/llm-config`
2. There is a global persona ("Todas as Tipologias" or similar with
   `tipologyId IS NULL`) populated with the IA-steering brief in
   `instructions`
3. `/recursos` shows the OpenAI resource with a masked apiKey
4. `pm2 describe bko-backend | grep 'exec cwd'` matches your deploy path

## Suggested first day

1. Clone both repos. Open the backend in VS Code with Claude Code attached.
2. Read **this file**, then `ARCHITECTURE.md`, then `GLOSSARY.md`. Skim
   `CLAUDE.md` in each repo.
3. Set up local env using `BKO-Deploy/`:
   - `docker compose up -d` to bring up Postgres
   - `./restore-db.sh bkoagent_2026-06-03_2203.dump` to restore
   - copy `.env.example` files to `.env` / `.env.local` and fill credentials
4. `npm install && npm run start:dev` in backend; `npm run dev` in console.
5. Log in to `http://localhost:3000/login` with an ADMIN account from the dump.
6. Open `/processar`, search a recent protocol, walk through the IA flow.
   Watch the violet "IA — verifique" badges populate; edit one; click
   Processar; observe the compliance gate (or the green path if everything
   is filled).
7. Open `/admin/analises/[id]` for a drill-down of one ticket.
8. Open `/personas` and inspect "Todas as Tipologias" — that's the global
   persona steering the IA's writing style.
9. **First PR suggestion:** pick one TODO from the open backlog and ship
   it small, focused, with screenshots.

## Conventions you'll be glad you followed

- **Don't bypass `RolesGuard` with `@Public()`** — if an endpoint should
  be reachable, list the roles explicitly. The operator-vs-admin IA bug
  (above) is a direct consequence of not following this.
- **Don't add defaults to LLM prompts.** "padrão: 5 a 10 dias úteis" was
  the literal cause of a production hallucination. If you find yourself
  typing a sample value into a prompt, stop — invariably it lands in a
  customer-facing response as fact.
- **Don't raise LLM temperatures without proof.** Especially `composicao`.
  See [Anti-hallucination invariants](#anti-hallucination-invariants).
- **Don't add backwards-compat shims** or feature flags for code with no
  consumer yet. If it's broken, fix it; if unused, delete it.
- **Don't rename without grep first.** The frontend uppercases roles but
  the backend doesn't — invariants like this are easy to break.
- **Don't widen masking exceptions.** If you need a real secret on the
  frontend, ask why instead.
- **Run `npm run build` (frontend) before commit.** Turbopack catches
  errors that `npx tsc --noEmit` misses.
- **Use `useRef` for async closures that need latest state.** The
  NoteForm IA-extract bug was a 3-8s async callback merging against a
  stale `values` from closure, wiping the synchronous prefill. The
  `valuesRef.current` pattern is now the convention for any effect that
  awaits.
