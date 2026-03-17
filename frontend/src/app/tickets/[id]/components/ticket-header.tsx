import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Complaint, ComplaintStatus, ComplaintRiskLevel } from '@/lib/types'

const statusLabels: Record<ComplaintStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  waiting_human: 'Aguardando humano',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const statusVariants: Record<ComplaintStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  waiting_human: 'outline',
  completed: 'secondary',
  cancelled: 'destructive',
}

const riskLabels: Record<ComplaintRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
}

const riskVariants: Record<ComplaintRiskLevel, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'default',
  critical: 'destructive',
}

interface TicketHeaderProps {
  complaint: Complaint
}

export function TicketHeader({ complaint }: TicketHeaderProps) {
  const slaText = complaint.slaDeadline
    ? new Date(complaint.slaDeadline).toLocaleDateString('pt-BR')
    : '—'

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/tickets"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Fila de Reclamações
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            {complaint.protocolNumber}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariants[complaint.status]}>
            {statusLabels[complaint.status]}
          </Badge>
          <Badge variant={riskVariants[complaint.riskLevel]}>
            Risco: {riskLabels[complaint.riskLevel]}
          </Badge>
          {complaint.isOverdue && (
            <Badge variant="destructive">SLA Vencido</Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Tipologia</dt>
          <dd className="font-medium">{complaint.tipology?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Situação</dt>
          <dd className="font-medium">{complaint.situation?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ação Regulatória</dt>
          <dd className="font-medium">{complaint.regulatoryAction?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">SLA</dt>
          <dd className={`font-medium ${complaint.isOverdue ? 'text-destructive' : ''}`}>
            {slaText}
            {complaint.slaBusinessDays ? ` (${complaint.slaBusinessDays} dias úteis)` : ''}
          </dd>
        </div>
      </dl>
    </div>
  )
}
