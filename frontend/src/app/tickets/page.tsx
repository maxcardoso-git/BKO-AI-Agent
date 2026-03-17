import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import type { ComplaintListResponse } from '@/lib/types'
import { TicketFilters } from './components/ticket-filters'
import { TicketTable } from './components/ticket-table'

interface SearchParams {
  status?: string
  riskLevel?: string
  isOverdue?: string
  page?: string
}

interface TicketsPageProps {
  searchParams: Promise<SearchParams>
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  await verifySession()

  const params = await searchParams
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.riskLevel) query.set('riskLevel', params.riskLevel)
  if (params.isOverdue) query.set('isOverdue', params.isOverdue)
  if (params.page) query.set('page', params.page)
  query.set('limit', '20')

  const res = await fetchAuthAPI(`/api/complaints?${query.toString()}`)
  const result: ComplaintListResponse = res.ok ? await res.json() : { data: [], total: 0, page: 1, limit: 20, totalPages: 0 }

  const currentPage = Number(params.page ?? 1)

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fila de Reclamações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {result.total} reclamação(ões) encontrada(s)
          </p>
        </div>
      </div>

      <TicketFilters
        currentStatus={params.status}
        currentRiskLevel={params.riskLevel}
        currentIsOverdue={params.isOverdue}
      />

      <div className="mt-4">
        <TicketTable complaints={result.data} />
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {currentPage} de {result.totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <a
                href={`?${new URLSearchParams({ ...params, page: String(currentPage - 1) }).toString()}`}
                className="underline"
              >
                Anterior
              </a>
            )}
            {currentPage < result.totalPages && (
              <a
                href={`?${new URLSearchParams({ ...params, page: String(currentPage + 1) }).toString()}`}
                className="underline"
              >
                Próxima
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
