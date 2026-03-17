import type { Execution } from '@/lib/types'

interface TicketExecutionsProps {
  executions: Execution[]
}

export function TicketExecutions({ executions }: TicketExecutionsProps) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Execuções</h2>
      {executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
      ) : (
        <ul className="space-y-4">
          {executions.map((execution) => (
            <li key={execution.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Execução #{execution.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(execution.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Status: {execution.status}
              </p>
              {execution.steps && execution.steps.length > 0 && (
                <ul className="mt-3 space-y-2 pl-4 border-l">
                  {execution.steps.map((step) => (
                    <li key={step.id} className="text-sm">
                      <span className="font-medium">{step.name}</span>
                      <span className="ml-2 text-muted-foreground">{step.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
