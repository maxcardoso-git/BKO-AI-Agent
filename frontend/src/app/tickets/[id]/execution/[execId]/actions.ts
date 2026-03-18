'use server'
import { fetchAuthAPI } from '@/lib/api'
import { revalidatePath } from 'next/cache'

export async function startExecution(complaintId: string, _prev: unknown, _formData: FormData) {
  const res = await fetchAuthAPI(`/api/complaints/${complaintId}/executions`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao iniciar execucao' }
  }
  revalidatePath(`/tickets/${complaintId}`)
  return { success: true }
}

export async function advanceStep(execId: string, complaintId: string, _prev: unknown, _formData: FormData) {
  const res = await fetchAuthAPI(`/api/executions/${execId}/advance`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao avancar etapa' }
  }
  revalidatePath(`/tickets/${complaintId}/execution/${execId}`)
  return { success: true }
}

export async function retryStep(execId: string, complaintId: string, _prev: unknown, _formData: FormData) {
  const res = await fetchAuthAPI(`/api/executions/${execId}/retry-step`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { message?: string }).message ?? 'Falha ao reprocessar etapa' }
  }
  revalidatePath(`/tickets/${complaintId}/execution/${execId}`)
  return { success: true }
}
