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
  targetStepKey?: string   // resolved before save; populated on load
}

export async function getTransitions(stepId: string): Promise<TransitionCondition[]> {
  const res = await fetchAuthAPI(`/api/admin/steps/${stepId}/transitions`)
  if (!res.ok) return []
  const data = await res.json() as Array<{
    conditionType: string
    conditionExpression: Record<string, unknown>
    targetStepKey: string
    priority?: number
  }>
  return data.map(t => ({
    condition: {
      field: t.conditionType ?? '',
      operator: (t.conditionExpression?.operator as string) ?? 'eq',
      value: (t.conditionExpression?.value as string) ?? '',
    },
    targetStepOrder: 0,         // will be resolved by UI from targetStepKey
    targetStepKey: t.targetStepKey ?? '',
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
  steps: StepItem[],
) {
  const payload = transitions.map(t => {
    // Prefer explicit targetStepKey; fall back to resolving from targetStepOrder
    const resolvedKey =
      t.targetStepKey ||
      steps.find(s => s.stepOrder === t.targetStepOrder)?.key ||
      String(t.targetStepOrder)

    return {
      conditionType: t.condition.field,
      conditionExpression: {
        operator: t.condition.operator,
        value: t.condition.value,
      },
      targetStepKey: resolvedKey,
    }
  })

  const res = await fetchAuthAPI(
    `/api/admin/steps/${stepId}/transitions`,
    {
      method: 'PUT',
      body: JSON.stringify({ transitions: payload }),
    }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao salvar transicoes' }
  }

  revalidatePath(`/admin/steps/${capabilityId}`)
  return { success: true }
}
