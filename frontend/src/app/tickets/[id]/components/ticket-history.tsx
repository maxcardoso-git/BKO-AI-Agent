import type { ComplaintHistory } from '@/lib/types'

interface TicketHistoryProps {
  history: ComplaintHistory[]
}

export function TicketHistory({ history }: TicketHistoryProps) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Histórico</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
      ) : (
        <ol className="relative border-l border-muted ml-3 space-y-6">
          {history.map((entry) => (
            <li key={entry.id} className="ml-6">
              <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-background" />
              <div>
                <time className="mb-1 block text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString('pt-BR')}
                </time>
                <p className="text-sm font-medium">{entry.action}</p>
                {entry.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                )}
                {(entry.previousStatus || entry.newStatus) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.previousStatus && (
                      <span>De: <strong>{entry.previousStatus}</strong></span>
                    )}
                    {entry.previousStatus && entry.newStatus && ' → '}
                    {entry.newStatus && (
                      <span>Para: <strong>{entry.newStatus}</strong></span>
                    )}
                  </p>
                )}
                {entry.performedBy && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Por: {entry.performedBy}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
