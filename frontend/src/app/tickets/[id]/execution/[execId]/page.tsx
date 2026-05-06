import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import type { Complaint, ExecutionDetail, ArtifactDetail } from '@/lib/types'
import { StepProcessor } from './components/step-processor'

interface PageProps {
  params: Promise<{ id: string; execId: string }>
}

export default async function ExecutionPage({ params }: PageProps) {
  await verifySession()
  const { id, execId } = await params

  const [complaintRes, executionRes, artifactsRes] = await Promise.all([
    fetchAuthAPI(`/api/complaints/${id}`),
    fetchAuthAPI(`/api/complaints/${id}/executions`),
    fetchAuthAPI(`/api/complaints/${id}/artifacts`),
  ])

  if (!complaintRes.ok) notFound()

  const complaint: Complaint = await complaintRes.json()
  const executions: ExecutionDetail[] = executionRes.ok ? await executionRes.json() : []
  const artifacts: ArtifactDetail[] = artifactsRes.ok ? await artifactsRes.json() : []

  const execution = executions.find(e => e.id === execId)
  if (!execution) notFound()

  return (
    <StepProcessor
      complaint={complaint}
      execution={execution}
      artifacts={artifacts}
    />
  )
}
