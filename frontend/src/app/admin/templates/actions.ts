'use server'

import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export type ActionState = { error?: string; success?: boolean }

export async function updateTemplate(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const contentRaw = formData.get('content') as string

  let content: unknown
  try {
    content = JSON.parse(contentRaw)
  } catch {
    // Store as string if not valid JSON
    content = contentRaw
  }

  const res = await fetchAuthAPI(`/api/admin/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ templateContent: typeof content === 'string' ? content : JSON.stringify(content) }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { error: err || 'Erro ao atualizar template' }
  }

  revalidatePath('/admin/templates')
  return { success: true }
}
