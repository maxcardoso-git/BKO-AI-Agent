'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_VALUE = '__all__'

interface TicketFiltersProps {
  currentStatus?: string
  currentRiskLevel?: string
  currentIsOverdue?: string
}

export function TicketFilters({
  currentStatus,
  currentRiskLevel,
  currentIsOverdue,
}: TicketFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function updateFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === ALL_VALUE) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    params.delete('page')
    router.push(`/tickets?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select
          value={currentStatus ?? ALL_VALUE}
          onValueChange={(v) => updateFilter('status', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em andamento</SelectItem>
            <SelectItem value="waiting_human">Aguardando humano</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Risco:</span>
        <Select
          value={currentRiskLevel ?? ALL_VALUE}
          onValueChange={(v) => updateFilter('riskLevel', v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">SLA:</span>
        <Select
          value={currentIsOverdue ?? ALL_VALUE}
          onValueChange={(v) => updateFilter('isOverdue', v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos</SelectItem>
            <SelectItem value="true">Vencido</SelectItem>
            <SelectItem value="false">No prazo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
