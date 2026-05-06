'use client'

import { useActionState } from 'react'
import { updateModel, ActionState } from './actions'

const initial: ActionState = {}

interface LlmModelConfig {
  id: string
  functionalityType: string
  provider: string
  modelId: string
  temperature: number
  maxTokens: number | null
  isActive: boolean
}

export function EditModelForm({ id, model }: { id: string; model: LlmModelConfig }) {
  const boundAction = updateModel.bind(null, id)
  const [state, action, pending] = useActionState(
    (_prev: ActionState, formData: FormData) => boundAction(_prev, formData),
    initial,
  )

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Model ID</label>
        <input
          name="modelId"
          defaultValue={model.modelId}
          required
          className="rounded-md border px-3 py-1.5 text-sm bg-background w-48"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Temperature</label>
        <input
          name="temperature"
          type="number"
          step={0.1}
          min={0}
          max={2}
          defaultValue={model.temperature}
          className="rounded-md border px-3 py-1.5 text-sm bg-background w-24"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Ativo</label>
        <select
          name="isActive"
          defaultValue={String(model.isActive)}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        >
          <option value="true">Sim</option>
          <option value="false">Nao</option>
        </select>
      </div>
      {state.error && <p className="text-xs text-destructive w-full">{state.error}</p>}
      {state.success && <p className="text-xs text-green-600 w-full">Salvo!</p>}
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
