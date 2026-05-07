---
plan: 09-03
status: complete
phase: 09-operator-ui-token-auth-rbac
---

# Summary: /processar Full UI

## What Was Built

### ProcessarClient.tsx (main orchestrator)
- Full client component: search → lock → note → process → progress flow
- Calls `GET /api/complaints/by-protocol?q=` on search
- Immediately calls `POST /api/complaints/:id/lock` after finding complaint
- 409 conflict shows LockBanner with force-release for SUPERVISOR/ADMIN
- NoteForm controlled by parent; `hasNoteContent` gates Iniciar Processamento button
- On start: saves note then calls `POST /api/complaints/:id/executions/start`
- Lock renewal via `setInterval` every 10 minutes
- ProgressBar component polls; parent renders visual bar with step counter

### ProtocolSearch.tsx
- Accepts Anatel protocol (15 digits) or internal protocol
- Calls `onSearch(q)` on submit; shows loading state

### ComplaintHeader.tsx
- Displays: protocolNumber, protocoloPrestadora, tipologia/classificação badge, riskLevel badge, slaDeadline, rawText (clamp-5)

### LockBanner.tsx
- Shows lockedBy name and time since lock
- "Tentar novamente" for all; "Forçar liberação" only for SUPERVISOR/ADMIN

### NoteForm.tsx
- 4 structured fields: plano contratado, valor cobrado, motivo declarado, data ocorrência
- 1 textarea: observação adicional
- Fully controlled via `values`/`onChange` props

### ProgressBar.tsx (headless)
- Polls `GET /api/proxy/executions/:id/steps` every 3 seconds
- Stops on terminal status: `paused_human`, `completed`, `failed`
- Calls `onUpdate(completed, total, status)` — parent renders visual bar

### page.tsx (updated)
- Client Component handling ?token= exchange flow
- Token missing → renders ProcessarClient directly
- Token present → POST to token-exchange → setAuth → router.replace('/processar')
- Failed exchange → error UI with "Token expirado, contate o administrador"

## Notes
- Frontend uses `process.env.NEXT_PUBLIC_API_URL ?? ''` for direct backend calls
- Auth cookies set automatically via auth.store.ts setAuth() (added in 09-02)
- BKOConsole git commits deferred pending pack index repair

## Files Created
- `src/app/(app)/processar/page.tsx` (updated)
- `src/app/(app)/processar/components/ProcessarClient.tsx`
- `src/app/(app)/processar/components/ProtocolSearch.tsx`
- `src/app/(app)/processar/components/ComplaintHeader.tsx`
- `src/app/(app)/processar/components/LockBanner.tsx`
- `src/app/(app)/processar/components/NoteForm.tsx`
- `src/app/(app)/processar/components/ProgressBar.tsx`
