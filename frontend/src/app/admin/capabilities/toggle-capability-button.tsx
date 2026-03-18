'use client'

import { updateCapability } from './actions'
import { useTransition } from 'react'

export function ToggleCapabilityButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    const formData = new FormData()
    formData.set('isActive', String(!isActive))
    startTransition(async () => {
      await updateCapability(id, {}, formData)
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {pending ? '...' : isActive ? 'Desativar' : 'Ativar'}
    </button>
  )
}
