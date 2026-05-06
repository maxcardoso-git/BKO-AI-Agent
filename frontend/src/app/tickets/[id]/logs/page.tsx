import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import Link from 'next/link'

interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function truncateJson(obj: Record<string, unknown> | null, maxLen = 200): string {
  if (!obj) return '—'
  const s = JSON.stringify(obj)
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s
}

export default async function TicketLogsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifySession()
  const { id: complaintId } = await params

  const res = await fetchAuthAPI(`/api/tickets/${complaintId}/logs`)
  const logs: AuditLogItem[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/tickets/${complaintId}`} className="text-sm text-muted-foreground hover:underline">
          ← Voltar ao Ticket
        </Link>
        <h1 className="text-xl font-semibold mt-2">Log de Execução</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">Ticket: {complaintId}</p>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum log de auditoria encontrado para este ticket.</p>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-2 px-3 font-medium">Data/Hora</th>
                <th className="text-left py-2 px-3 font-medium">Ação</th>
                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                <th className="text-left py-2 px-3 font-medium">Usuário</th>
                <th className="text-left py-2 px-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="py-2 px-3 whitespace-nowrap font-mono">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="py-2 px-3 font-mono font-medium">{log.action}</td>
                  <td className="py-2 px-3 text-muted-foreground">{log.entityType}</td>
                  <td className="py-2 px-3 text-muted-foreground">{log.userId ?? '—'}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground max-w-xs truncate">
                    {truncateJson(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
