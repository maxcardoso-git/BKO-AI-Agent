import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface LlmCallItem {
  id: string
  model: string
  provider: string
  latencyMs: number | null
  responseStatus: string
}

interface ArtifactItem {
  id: string
  artifactType: string
  createdAt: string
}

interface StepTrace {
  id: string
  stepKey: string
  status: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  errorMessage: string | null
  retryCount: number
  llm_calls: LlmCallItem[]
  artifacts: ArtifactItem[]
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed': return 'default'
    case 'failed': return 'destructive'
    case 'running': return 'secondary'
    case 'waiting_human': return 'outline'
    default: return 'secondary'
  }
}

export default async function TraceExplorerPage({
  params,
}: {
  params: Promise<{ execId: string }>
}) {
  await verifySession()
  const { execId } = await params

  const res = await fetchAuthAPI(`/api/admin/observability/trace/${execId}`)
  const steps: StepTrace[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-lg px-4 py-8">
      <div className="mb-6">
        <Link href="/admin/observability" className="text-sm text-muted-foreground hover:underline">
          ← Observabilidade
        </Link>
        <h1 className="text-xl font-semibold mt-2">Trace Explorer</h1>
        <p className="text-xs text-muted-foreground font-mono mt-1">Execução: {execId}</p>
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum step encontrado para esta execução.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {steps.map((step, idx) => (
            <div key={step.id} className="bg-gray-50 rounded p-3 m-2">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                <span className="font-medium text-sm">{step.stepKey}</span>
                <Badge variant={statusVariant(step.status)} className="text-xs">
                  {step.status}
                </Badge>
                {step.durationMs != null && (
                  <span className="text-xs text-muted-foreground ml-auto">{step.durationMs}ms</span>
                )}
              </div>

              {step.errorMessage && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
                  Erro: {step.errorMessage}
                </p>
              )}

              {step.retryCount > 0 && (
                <p className="text-xs text-amber-600 mb-2">Retentativas: {step.retryCount}</p>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2">
                {/* LLM Calls */}
                {step.llm_calls.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Chamadas LLM ({step.llm_calls.length})</p>
                    <ul className="space-y-1">
                      {step.llm_calls.map((lc) => (
                        <li key={lc.id} className="text-xs bg-white border rounded px-2 py-1">
                          <span className="font-mono">{lc.model}</span>
                          <span className="text-muted-foreground"> ({lc.provider})</span>
                          {lc.latencyMs != null && (
                            <span className="ml-2 text-muted-foreground">{lc.latencyMs}ms</span>
                          )}
                          <span className={`ml-2 ${lc.responseStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {lc.responseStatus}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Artifacts */}
                {step.artifacts.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Artefatos ({step.artifacts.length})</p>
                    <ul className="space-y-1">
                      {step.artifacts.map((a) => (
                        <li key={a.id} className="text-xs bg-white border rounded px-2 py-1">
                          <span className="font-mono">{a.artifactType}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
