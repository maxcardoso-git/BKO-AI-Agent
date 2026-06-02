# Handoff — BKO AI Agent

Snapshot of the project as of **2026-06-02**. Read this once; refresh by
running `git log` after.

## TL;DR

- Backend is production-stable on the reference VPS (`72.61.52.70`,
  `pm2 → bko-backend`, port 3111).
- Frontend (BKO Console) is production-stable on the same VPS
  (`pm2 → bko-console`, port 3000).
- Both repos on GitHub are now the source of truth and match what's
  running on the VPS.
- A deploy package (DB dump + env templates + restore script) is
  delivered **out-of-band** as `BKO-Deploy/` (contains secrets).
- The codebase is one tenant, one DB. Multi-tenant is not implemented.

## What works

### Operator flow (`/processar`)
- Token-exchange entry from Turbina
- Search by `protocolo`
- Per-ticket drill-down (analytics summary)
- Lock acquisition + 30s heartbeat
- IA pipeline: parse → draft → compliance → composer
- Smart Note (sintetizar/rewrite/etc.)
- Persona check (blocks approve on missing/forbidden expressions)
- Approve / Correct / Reject with HumanReview persistence
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
- `/llm-config` — LLM model config per functionality (with apiKey resolved from `resource`)
- `/personas`, `/templates`, `/skills`, `/steps`, `/kb`, `/regulatory`, `/memory`
- `/turbina` — bulk import with operator-saved filter presets

### Infrastructure
- LLM apiKey lives in DB (`resource.apiKeyValue`), not `.env` — env is
  fallback only. The OPENAI_API_KEY was removed from the VPS `.env` after
  populating the resource row.
- Embeddings: OpenAI `text-embedding-3-small`, 1536 dims, stored in
  pgvector columns.
- Secret masking is end-to-end: backend returns `first8***last4` and
  `hasApiKeyValue: bool`; frontend never sees the real key.

## What's WIP / known issues

### IA broken for OPERATOR in a sister environment (2026-06-02)
There is *another* deploy of this product (not the reference VPS) where
processing a ticket as OPERATOR fails to run the IA, while ADMIN works.
The likely cause is an older backend where an endpoint in the operator's
flow is still gated `@Roles(ADMIN)` only — top candidates are
`/admin/analytics/tickets/:id`, `/complaints/:id/sentiment-preview`, or
`/complaints/:id/executions/start`.

**The current backend (commit `8084438`+) has these correctly opened to
OPERATOR.** Redeploying the GitHub `main` to that environment should fix.

### EventsGateway is registered but not used
`src/events.gateway.ts` is a WS scaffold (handleConnection + emit helpers)
that no frontend consumes yet. Kept for future use; package deps are
declared (`@nestjs/websockets`, `@nestjs/platform-socket.io`).

### Old `webhook.*` + `ingest.*` + `user.controller` files
Were on the VPS as dead code (not registered in any module). Deleted on
2026-06-01 during the VPS↔Git reconciliation. If a webhook/ingest feature
gets requested again, the commit history (`git log --diff-filter=D --oneline`)
points to the prior shape.

### iCloud + git push pitfall (macOS local dev)
The original developer's `~/Documents/EngDB` is iCloud-synced, and that
breaks `git pack-objects` (`mmap: Operation timed out`) for the frontend
repo. Workaround used on 2026-06-01: do the commit on the VPS, push from
there with a PAT, then reset the URL. If you ever hit this, **move the
working copy out of iCloud Drive**.

## Recent significant commits

Backend (`maxcardoso-git/BKO-AI-Agent`):
- `8084438` — admin users management, resource secret masking, websocket deps
- `4d2592f` — resolve LLM API key from DB (resource.apiKeyValue) with .env fallback
- `1ab8625` — IQI override + learning loop, persona-aware smart-note, exports, mandatory-info admin
- `ff2e98d` — turbina filter preset + admin reset endpoint
- `75b9d85` — per-ticket analytics endpoint + read-only view for processed tickets
- `778a11f` — AI response rating + compliance recheck endpoint

Frontend (`maxcardoso-git/BKO-Console`):
- `b2098b9` — initial snapshot matching VPS production state (squashed; the
  pre-snapshot lineage was VPS-only)

## Production reference

| Service | Host | Port | pm2 name | Path |
|---|---|---|---|---|
| Postgres (pgvector pg17) | `72.61.52.70` (Docker) | 5433 | container `bkoagent-postgres-1` | volume `bkoagent_pgdata` |
| Backend | `72.61.52.70` | 3111 | `bko-backend` | `/root/EngDB/BKOAgent/backend` |
| Frontend | `72.61.52.70` | 3000 | `bko-console` | `/root/EngDB/BKOConsole` |

```bash
ssh root@72.61.52.70
pm2 list                          # see processes
pm2 logs bko-backend --lines 100
pm2 restart bko-backend --update-env
docker exec -it bkoagent-postgres-1 psql -U bko -d bkoagent
```

## How to deploy on a fresh server

Use `BKO-Deploy/DEPLOY.md` (delivered separately). It walks through:
clone repos → docker compose up postgres → restore dump → write `.env`
→ build + pm2 start.

## Suggested first day

1. Clone both repos. Open the backend in VS Code with Claude Code attached.
2. Read **this file**, then `ARCHITECTURE.md`, then `GLOSSARY.md`. Skim
   `CLAUDE.md` in each repo.
3. Set up local env using `BKO-Deploy/`:
   - `docker compose up -d` to bring up Postgres
   - `./restore-db.sh` to restore the dump
   - copy `.env.example` files to `.env` / `.env.local` and fill credentials
4. `npm install && npm run start:dev` in backend; `npm run dev` in console.
5. Log in to `http://localhost:3000/login` with an ADMIN account from the dump.
6. Open `/processar`, search a recent protocol, walk through the IA flow.
7. Open `/admin/analises/[id]` for a drill-down of one ticket.
8. **First PR suggestion:** pick one TODO from the open backlog
   (`HANDOFF.md` should grow this list as work continues) and ship it
   small, focused, with screenshots.

## Conventions you'll be glad you followed

- Don't bypass `RolesGuard` with `@Public()` — if an endpoint should be
  reachable, list the roles explicitly. The operator-vs-admin IA bug
  (above) is a direct consequence of not following this.
- Don't add backwards-compat shims or feature flags for code that has no
  consumer yet. If something is broken, fix it; if it's unused, delete it.
- Don't rename without grep first. The frontend uppercases roles but the
  backend doesn't — invariants like this are easy to break.
- Don't widen masking exceptions. If you need a real secret on the
  frontend, ask why instead.
- Run `npm run build` (frontend) before commit. Turbopack catches errors
  that `npx tsc --noEmit` misses.
