import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import type { Complaint, ArtifactDetail } from '@/lib/types'
import { HitlEditor } from './components/hitl-editor'

interface PageProps {
  params: Promise<{ id: string; execId: string; stepExecId: string }>
}

export default async function HitlReviewPage({ params }: PageProps) {
  await verifySession()
  const { id, execId, stepExecId } = await params

  // Fetch complaint + all artifacts for this execution
  const [complaintRes, artifactsRes, existingReviewRes] = await Promise.all([
    fetchAuthAPI(`/api/complaints/${id}`),
    fetchAuthAPI(`/api/complaints/${id}/artifacts`),
    fetchAuthAPI(`/api/executions/${execId}/steps/${stepExecId}/review`),
  ])

  if (!complaintRes.ok) notFound()

  const complaint: Complaint = await complaintRes.json()
  const artifacts: ArtifactDetail[] = artifactsRes.ok ? await artifactsRes.json() : []

  // Extract AI draft from ART-09 (final_response artifact)
  const finalResponseArtifact = artifacts
    .filter(a => a.artifactType === 'final_response')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const aiDraft = (finalResponseArtifact?.content?.['finalResponse'] as string) ?? ''

  // Extract checklist template from ART-06 (mandatory_checklist artifact)
  const checklistArtifact = artifacts
    .filter(a => a.artifactType === 'mandatory_checklist')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const checklistTemplate = (checklistArtifact?.content?.['items'] as Array<{ fieldName: string; fieldLabel: string; isRequired: boolean }>) ?? []

  // Load existing review if already submitted
  const existingReview = existingReviewRes.ok ? await existingReviewRes.json() : null

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Revisao HITL — {complaint.protocolNumber}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revise o texto gerado pela IA, complete o checklist regulatorio e aprove a resposta final.
        </p>
      </div>
      <HitlEditor
        execId={execId}
        stepExecId={stepExecId}
        complaintId={id}
        aiDraft={aiDraft}
        checklistTemplate={checklistTemplate}
        existingReview={existingReview}
      />
    </main>
  )
}
