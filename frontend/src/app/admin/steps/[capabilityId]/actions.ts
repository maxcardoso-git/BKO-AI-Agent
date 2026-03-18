'use server'
import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export interface StepItem {
  id?: string
  key: string
  name: string
  stepOrder: number
  isHumanRequired: boolean
  isActive: boolean
  skillKey: string | null
  llmModel: string | null
}

export interface TransitionCondition {
  condition: { field: string; operator: string; value: string }
  targetStepOrder: number
}

export async function getTransitions(stepId: string): Promise<TransitionCondition[]> {
  const res = await fetchAuthAPI(`/api/admin/steps/${stepId}/transitions`)
  if (!res.ok) return []
  const data = await res.json()
  return (data as Array<{ condition: { field?: string; operator?: string; value?: string }; targetStepOrder: number }>).map(t => ({
    condition: {
      field: t.condition?.field ?? '',
      operator: t.condition?.operator ?? 'eq',
      value: t.condition?.value ?? '',
    },
    targetStepOrder: t.targetStepOrder,
  }))
}

export async function saveSteps(
  capabilityId: string,
  versionId: string,
  steps: StepItem[],
) {
  const res = await fetchAuthAPI(
    `/api/admin/capabilities/${capabilityId}/versions/${versionId}/steps`,
    {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao salvar steps' }
  }

  revalidatePath(`/admin/steps/${capabilityId}`)
  revalidatePath('/admin/steps')
  return { success: true }
}

export async function saveTransitions(
  stepId: string,
  capabilityId: string,
  transitions: TransitionCondition[],
) {
  const res = await fetchAuthAPI(
    `/api/admin/steps/${stepId}/transitions`,
    {
      method: 'PUT',
      body: JSON.stringify({ transitions }),
    }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao salvar transicoes' }
  }

  revalidatePath(`/admin/steps/${capabilityId}`)
  return { success: true }
}
