'use server'

import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: boolean }

export async function updateModel(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const modelId = formData.get('modelId') as string
  const temperature = Number(formData.get('temperature'))
  const isActive = formData.get('isActive') === 'true'

  if (!modelId) return { error: 'Model ID obrigatorio' }

  const res = await fetchAuthAPI(`/api/admin/models/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ modelId, temperature, isActive }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { error: err || 'Erro ao atualizar modelo' }
  }

  revalidatePath('/admin/models')
  return { success: true }
}
