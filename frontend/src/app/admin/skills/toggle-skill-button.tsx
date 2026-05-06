'use client'

import { toggleSkill } from './actions'
import { useTransition } from 'react'

export function ToggleSkillButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      await toggleSkill(id, isActive)
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
