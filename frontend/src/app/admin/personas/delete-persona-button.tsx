'use client'

import { deletePersona } from './actions'

export function DeletePersonaButton({ id }: { id: string }) {
  async function handleDelete() {
    if (confirm('Remover esta persona?')) {
      await deletePersona(id)
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-destructive hover:underline"
    >
      Remover
    </button>
  )
}
