import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import type { Complaint, Execution, Artifact } from '@/lib/types'
import { TicketHeader } from './components/ticket-header'
import { TicketDetails } from './components/ticket-details'
import { TicketHistory } from './components/ticket-history'
import { TicketExecutions } from './components/ticket-executions'
import { TicketArtifacts } from './components/ticket-artifacts'

interface TicketPageProps {
  params: Promise<{ id: string }>
}

export default async function TicketPage({ params }: TicketPageProps) {
  await verifySession()

  const { id } = await params

  const [complaintRes, executionsRes, artifactsRes] = await Promise.all([
    fetchAuthAPI(`/api/complaints/${id}`),
    fetchAuthAPI(`/api/complaints/${id}/executions`),
    fetchAuthAPI(`/api/complaints/${id}/artifacts`),
  ])

  if (!complaintRes.ok) {
    notFound()
  }

  const complaint: Complaint = await complaintRes.json()
  const executions: Execution[] = executionsRes.ok ? await executionsRes.json() : []
  const artifacts: Artifact[] = artifactsRes.ok ? await artifactsRes.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8 space-y-6">
      <TicketHeader complaint={complaint} />
      <TicketDetails complaint={complaint} />
      <TicketHistory history={complaint.history ?? []} />
      <TicketExecutions executions={executions} />
      <TicketArtifacts artifacts={artifacts} />
    </main>
  )
}
