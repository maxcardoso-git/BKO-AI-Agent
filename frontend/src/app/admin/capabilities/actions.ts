'use server'

import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: boolean }

export async function updateCapability(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const isActive = formData.get('isActive') === 'true'

  const res = await fetchAuthAPI(`/api/admin/capabilities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { error: err || 'Erro ao atualizar capability' }
  }

  revalidatePath('/admin/capabilities')
  return { success: true }
}
