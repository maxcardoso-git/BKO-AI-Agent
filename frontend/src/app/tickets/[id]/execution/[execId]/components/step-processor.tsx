'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { advanceStep, retryStep } from '../actions'
import type { ActionState } from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Complaint, ExecutionDetail, ArtifactDetail } from '@/lib/types'

interface Props {
  complaint: Complaint
  execution: ExecutionDetail
  artifacts: ArtifactDetail[]
}

// Status badge color mapping
function StepBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    waiting_human: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<string, string> = {
    completed: 'Concluida',
    failed: 'Falhou',
    waiting_human: 'Aguarda Humano',
    in_progress: 'Em Andamento',
    pending: 'Pendente',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

export function StepProcessor({ complaint, execution, artifacts }: Props) {
  const boundAdvance = advanceStep.bind(null, execution.id, complaint.id)
  const boundRetry = retryStep.bind(null, execution.id, complaint.id)
  const [advanceState, advanceAction, isPending] = useActionState<ActionState, FormData>(boundAdvance, {})
  const [retryState, retryAction, isRetryPending] = useActionState<ActionState, FormData>(boundRetry, {})

  const currentStepExec = execution.stepExecutions?.find(
    s => s.stepKey === execution.currentStepKey
  ) ?? null

  const waitingStepExec = execution.stepExecutions?.find(
    s => s.status === 'waiting_human'
  ) ?? null

  // Find current artifact: prefer artifact linked to current step, fall back to last overall
  const currentArtifact = artifacts.filter(
    a => a.stepExecutionId === currentStepExec?.id
  ).at(-1) ?? artifacts.at(-1) ?? null

  const isWaitingHuman = execution.status === 'paused_human'
  const isFailed = currentStepExec?.status === 'failed'
  const isCompleted = execution.status === 'completed'

  return (
    <main className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Execucao: {complaint.protocolNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Status: <StepBadge status={execution.status} />
          </p>
        </div>
        <Link href={`/tickets/${complaint.id}`} className="text-sm text-blue-600 hover:underline">
          Voltar ao Ticket
        </Link>
      </div>

      {/* 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[600px]">

        {/* Col 1: Ticket Data */}
        <Card className="p-4 space-y-3">
          <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Dados do Ticket</h2>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Protocolo:</span> {complaint.protocolNumber}</div>
            <div><span className="font-medium">Tipologia:</span> {complaint.tipology?.name ?? '—'}</div>
            <div><span className="font-medium">Situacao:</span> {complaint.situation?.name ?? '—'}</div>
            <div><span className="font-medium">Risco:</span> {complaint.riskLevel}</div>
            <div><span className="font-medium">SLA:</span> {complaint.slaDeadline ? new Date(complaint.slaDeadline).toLocaleDateString('pt-BR') : '—'}</div>
            {complaint.isOverdue && (
              <div className="rounded bg-red-50 px-2 py-1 text-red-700 text-xs font-medium">VENCIDO</div>
            )}
          </div>
          <div className="mt-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-1">Texto da Reclamacao</h3>
            <p className="text-xs text-gray-700 line-clamp-6">{complaint.rawText}</p>
          </div>
        </Card>

        {/* Col 2: Current Step */}
        <Card className="p-4 space-y-3">
          <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Etapa Atual</h2>
          {currentStepExec ? (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Skill:</span> {currentStepExec.stepKey}</div>
              <div><span className="font-medium">Status:</span> <StepBadge status={currentStepExec.status} /></div>
              {currentStepExec.duration && (
                <div><span className="font-medium">Duracao:</span> {(currentStepExec.duration / 1000).toFixed(1)}s</div>
              )}
              {currentStepExec.error && (
                <div className="rounded bg-red-50 p-2 text-xs text-red-700 font-mono break-all">{currentStepExec.error}</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma etapa iniciada</p>
          )}
          {/* Step history list */}
          <div className="mt-3 space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground">Historico de Etapas</h3>
            {execution.stepExecutions?.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${s.status === 'completed' ? 'bg-green-500' : s.status === 'failed' ? 'bg-red-500' : s.status === 'waiting_human' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <span className="font-mono truncate max-w-[120px]">{s.stepKey}</span>
                <StepBadge status={s.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Col 3: Generated Artifact — filtered to current step, fallback to last overall */}
        <Card className="p-4 space-y-3 overflow-auto">
          <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Artefato Gerado</h2>
          {currentArtifact ? (
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">{currentArtifact.artifactType}</Badge>
              <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                {JSON.stringify(currentArtifact.content, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum artefato ainda</p>
          )}
        </Card>

        {/* Col 4: Human Action Panel */}
        <Card className="p-4 space-y-4">
          <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Revisao Humana</h2>

          {isCompleted && (
            <div className="rounded bg-green-50 p-3 text-sm text-green-700 font-medium">
              Execucao concluida com sucesso.
            </div>
          )}

          {isWaitingHuman && waitingStepExec && (
            <div className="space-y-3">
              <div className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">
                Esta etapa requer revisao humana antes de prosseguir.
              </div>
              <Link
                href={`/tickets/${complaint.id}/execution/${execution.id}/review/${waitingStepExec.id}`}
                className="block w-full"
              >
                <Button className="w-full" variant="default">
                  Abrir Editor HITL
                </Button>
              </Link>
            </div>
          )}

          {!isCompleted && !isWaitingHuman && (
            <div className="space-y-3">
              {isFailed && (
                <form action={retryAction}>
                  <Button type="submit" variant="outline" className="w-full" disabled={isRetryPending}>
                    {isRetryPending ? 'Reprocessando...' : 'Reprocessar Etapa'}
                  </Button>
                </form>
              )}
              {retryState?.error && (
                <p className="text-xs text-red-600">{retryState.error}</p>
              )}

              <form action={advanceAction}>
                <Button type="submit" className="w-full" disabled={isPending || isFailed}>
                  {isPending ? 'Avancando...' : 'Avancar Etapa'}
                </Button>
              </form>
              {advanceState?.error && (
                <p className="text-xs text-red-600">{advanceState.error}</p>
              )}
            </div>
          )}
        </Card>

      </div>
    </main>
  )
}
