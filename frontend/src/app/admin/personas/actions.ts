'use server'

import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: boolean }

export async function createPersona(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = formData.get('name') as string
  const tipologyId = (formData.get('tipologyId') as string) || null
  const formalityLevel = Number(formData.get('formalityLevel')) || 3
  const empathyLevel = Number(formData.get('empathyLevel')) || 3
  const assertivenessLevel = Number(formData.get('assertivenessLevel')) || 3
  const requiredRaw = (formData.get('requiredExpressions') as string) || ''
  const forbiddenRaw = (formData.get('forbiddenExpressions') as string) || ''

  const requiredExpressions = requiredRaw
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  const forbiddenExpressions = forbiddenRaw
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  if (!name) return { error: 'Nome obrigatorio' }

  const res = await fetchAuthAPI('/api/admin/personas', {
    method: 'POST',
    body: JSON.stringify({
      name,
      tipologyId,
      formalityLevel,
      empathyLevel,
      assertivenessLevel,
      requiredExpressions: requiredExpressions.length ? requiredExpressions : null,
      forbiddenExpressions: forbiddenExpressions.length ? forbiddenExpressions : null,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { error: err || 'Erro ao criar persona' }
  }

  revalidatePath('/admin/personas')
  return { success: true }
}

export async function deletePersona(id: string): Promise<ActionState> {
  const res = await fetchAuthAPI(`/api/admin/personas/${id}`, { method: 'DELETE' })
  if (!res.ok) return { error: 'Erro ao deletar persona' }
  revalidatePath('/admin/personas')
  return { success: true }
}
