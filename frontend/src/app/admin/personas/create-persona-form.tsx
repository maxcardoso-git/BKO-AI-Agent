'use client'

import { useActionState } from 'react'
import { createPersona, ActionState } from './actions'

const initial: ActionState = {}

export function CreatePersonaForm() {
  const [state, action, pending] = useActionState(createPersona, initial)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nome *</label>
        <input
          name="name"
          required
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          placeholder="Ex: Persona Cobranca"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">ID da Tipologia (opcional)</label>
        <input
          name="tipologyId"
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          placeholder="UUID da tipologia ou vazio para global"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Formalidade (1-5)</label>
          <input
            name="formalityLevel"
            type="number"
            min={1}
            max={5}
            defaultValue={3}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Empatia (1-5)</label>
          <input
            name="empathyLevel"
            type="number"
            min={1}
            max={5}
            defaultValue={3}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Assertividade (1-5)</label>
          <input
            name="assertivenessLevel"
            type="number"
            min={1}
            max={5}
            defaultValue={3}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Expressoes Requeridas (uma por linha)</label>
        <textarea
          name="requiredExpressions"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-none"
          placeholder="prezado cliente&#10;agradecemos"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Expressoes Proibidas (uma por linha)</label>
        <textarea
          name="forbiddenExpressions"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-none"
          placeholder="infelizmente&#10;impossivel"
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600">Persona criada com sucesso!</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar Persona'}
      </button>
    </form>
  )
}
