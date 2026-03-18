'use server'
import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type ReviewActionState = { error?: string }

export async function submitHumanReview(
  execId: string,
  stepExecId: string,
  complaintId: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const humanFinalText = formData.get('humanFinalText') as string
  const correctionReason = formData.get('correctionReason') as string | null
  const observations = formData.get('observations') as string | null

  // Collect checklist items from formData (checkbox inputs named 'checklist_<fieldName>')
  const checklistItems: Record<string, boolean> = {}
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('checklist_')) {
      checklistItems[key.replace('checklist_', '')] = value === 'on'
    }
  }

  // Step 1: Persist the review
  const reviewRes = await fetchAuthAPI(
    `/api/executions/${execId}/steps/${stepExecId}/review`,
    {
      method: 'POST',
      body: JSON.stringify({
        humanFinalText: humanFinalText || null,
        correctionReason: correctionReason || null,
        checklistItems: Object.keys(checklistItems).length > 0 ? checklistItems : null,
        observations: observations || null,
        approved: true,
      }),
    }
  )

  if (!reviewRes.ok) {
    const body = await reviewRes.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao salvar revisao' }
  }

  const review = await reviewRes.json()

  // Step 2: Advance execution with operatorInput — must pass operatorInput to bypass WAITING_HUMAN gate
  await fetchAuthAPI(`/api/executions/${execId}/advance`, {
    method: 'POST',
    body: JSON.stringify({
      operatorInput: { humanReviewId: review.id, approved: true },
    }),
  })

  revalidatePath(`/tickets/${complaintId}/execution/${execId}`)
  // redirect() must be OUTSIDE try/catch — call it at end of function after all awaits
  redirect(`/tickets/${complaintId}/execution/${execId}`)
}
