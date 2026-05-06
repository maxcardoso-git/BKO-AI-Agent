import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatSLA(complaint: Complaint): string {
  if (!complaint.slaDeadline) return '—'
  const deadline = new Date(complaint.slaDeadline)
  const formatted = deadline.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return complaint.isOverdue ? `${formatted} (Vencido)` : formatted
}

interface TicketTableProps {
  complaints: Complaint[]
}

export function TicketTable({ complaints }: TicketTableProps) {
  if (complaints.length === 0) {
    return (
      <div className="rounded-md border px-6 py-12 text-center text-muted-foreground">
        Nenhuma reclamação encontrada.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocolo</TableHead>
            <TableHead>Tipologia</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Risco</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map((complaint) => (
            <TableRow key={complaint.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link
                  href={`/tickets/${complaint.id}`}
                  className="block w-full font-medium text-primary underline-offset-4 hover:underline"
                >
                  {complaint.protocolNumber}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/tickets/${complaint.id}`} className="block w-full">
                  {complaint.tipology?.name ?? '—'}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/tickets/${complaint.id}`} className="block w-full">
                  <Badge variant={statusVariants[complaint.status]}>
                    {statusLabels[complaint.status]}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/tickets/${complaint.id}`} className="block w-full">
                  <Badge variant={riskVariants[complaint.riskLevel]}>
                    {riskLabels[complaint.riskLevel]}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/tickets/${complaint.id}`} className={`block w-full ${complaint.isOverdue ? 'text-destructive font-medium' : ''}`}>
                  {formatSLA(complaint)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/tickets/${complaint.id}`} className="block w-full text-muted-foreground">
                  {formatDate(complaint.createdAt)}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
