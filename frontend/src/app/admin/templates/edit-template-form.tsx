'use client'

import { useActionState } from 'react'
import { updateTemplate, ActionState } from './actions'

const initial: ActionState = {}

export function EditTemplateForm({ id, currentContent }: { id: string; currentContent: string }) {
  const boundAction = updateTemplate.bind(null, id)
  const [state, action, pending] = useActionState(
    (_prev: ActionState, formData: FormData) => boundAction(_prev, formData),
    initial,
  )

  return (
    <form action={action} className="space-y-2">
      <textarea
        name="content"
        rows={4}
        defaultValue={currentContent}
        className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-y font-mono"
      />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-green-600">Salvo!</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-secondary text-secondary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
