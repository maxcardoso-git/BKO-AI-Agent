'use server'

import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: boolean }

export async function toggleSkill(id: string, currentIsActive: boolean): Promise<ActionState> {
  const res = await fetchAuthAPI(`/api/admin/skills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: !currentIsActive }),
  })

  if (!res.ok) return { error: 'Erro ao atualizar skill' }
  revalidatePath('/admin/skills')
  return { success: true }
}
