'use client'
import { useState, useTransition } from 'react'
import { saveSteps, saveTransitions, getTransitions, type StepItem, type TransitionCondition } from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Props {
  capabilityId: string
  versionId: string
  initialSteps: StepItem[]
}

// Inline transitions editor for a single step
function TransitionsEditor({
  stepId,
  capabilityId,
  steps,
}: {
  stepId: string
  capabilityId: string
  steps: StepItem[]
}) {
  const [transitions, setTransitions] = useState<TransitionCondition[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Lazy-load transitions when section is opened (uses server action to avoid direct client-side backend fetch)
  async function loadTransitions() {
    if (loaded) return
    const data = await getTransitions(stepId)
    setTransitions(data)
    setLoaded(true)
  }

  function addRow() {
    setTransitions(prev => [
      ...prev,
      {
        condition: { field: '', operator: 'eq', value: '' },
        targetStepOrder: steps[0]?.stepOrder ?? 1,
        targetStepKey: steps[0]?.key ?? '',
      },
    ])
    setSaved(false)
  }

  function removeRow(index: number) {
    setTransitions(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function updateRow(index: number, patch: Partial<TransitionCondition>) {
    setTransitions(prev =>
      prev.map((t, i) => i === index ? { ...t, ...patch } : t)
    )
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveTransitions(stepId, capabilityId, transitions, steps)
      if (result && 'error' in result) {
        setError(result.error as string)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="mt-2 border rounded p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">Condicoes de Transicao (DSGN-04/05)</span>
        <button
          type="button"
          onClick={loadTransitions}
          className="text-xs text-blue-600 hover:underline"
        >
          {loaded ? '' : 'Carregar'}
        </button>
      </div>

      {loaded && (
        <>
          {transitions.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma condicao. Clique em + para adicionar.</p>
          )}
          {transitions.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="campo (ex: procedencia)"
                value={t.condition.field}
                onChange={e => updateRow(idx, { condition: { ...t.condition, field: e.target.value } })}
                className="text-xs border rounded px-2 py-1 w-32"
              />
              <select
                value={t.condition.operator}
                onChange={e => updateRow(idx, { condition: { ...t.condition, operator: e.target.value } })}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="eq">= (igual)</option>
                <option value="neq">!= (diferente)</option>
                <option value="gt">&gt; (maior)</option>
                <option value="lt">&lt; (menor)</option>
                <option value="in">in (lista)</option>
              </select>
              <input
                type="text"
                placeholder="valor"
                value={t.condition.value}
                onChange={e => updateRow(idx, { condition: { ...t.condition, value: e.target.value } })}
                className="text-xs border rounded px-2 py-1 w-28"
              />
              <span className="text-xs text-muted-foreground">→ step</span>
              <select
                value={t.targetStepKey ?? ''}
                onChange={e => {
                  const selected = steps.find(s => s.key === e.target.value)
                  updateRow(idx, {
                    targetStepKey: e.target.value,
                    targetStepOrder: selected?.stepOrder ?? 0,
                  })
                }}
                className="text-xs border rounded px-2 py-1 w-36"
              >
                <option value="">-- step alvo --</option>
                {steps.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.stepOrder}. {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-xs text-red-500 hover:text-red-700"
                aria-label="Remover condicao"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-blue-600 hover:underline"
            >
              + Adicionar condicao
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="text-xs text-green-700 hover:underline disabled:opacity-50"
            >
              {isPending ? 'Salvando...' : 'Salvar transicoes'}
            </button>
            {saved && <span className="text-xs text-green-600">Salvo!</span>}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </>
      )}
    </div>
  )
}

export function StepsDesigner({ capabilityId, versionId, initialSteps }: Props) {
  const [steps, setSteps] = useState<StepItem[]>(
    [...initialSteps].sort((a, b) => a.stepOrder - b.stepOrder)
  )
  const [expandedTransitions, setExpandedTransitions] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function moveStep(index: number, direction: 'up' | 'down') {
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSteps.length) return
    ;[newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]]
    // Reassign stepOrder sequentially
    setSteps(newSteps.map((s, i) => ({ ...s, stepOrder: i + 1 })))
    setSaved(false)
  }

  function toggleHumanRequired(index: number) {
    setSteps(prev =>
      prev.map((s, i) => i === index ? { ...s, isHumanRequired: !s.isHumanRequired } : s)
    )
    setSaved(false)
  }

  function updateField(index: number, field: 'skillKey' | 'llmModel', value: string) {
    setSteps(prev =>
      prev.map((s, i) => i === index ? { ...s, [field]: value || null } : s)
    )
    setSaved(false)
  }

  function toggleTransitions(stepKey: string) {
    setExpandedTransitions(prev => ({ ...prev, [stepKey]: !prev[stepKey] }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await saveSteps(capabilityId, versionId, steps)
      if (result && 'error' in result) {
        setError(result.error as string)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reordene steps, configure skill/LLM e defina condicoes de transicao por campo regulatorio.
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Salvo!</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar Fluxo'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <Card key={step.key} className={`p-4 ${!step.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-4">
              <span className="text-sm font-mono text-muted-foreground w-6 mt-1">{step.stepOrder}</span>

              <div className="flex-1 space-y-2">
                {/* Step name and key */}
                <div>
                  <p className="font-medium text-sm">{step.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{step.key}</p>
                </div>

                {/* skillKey and llmModel inputs */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Skill:</label>
                    <input
                      type="text"
                      value={step.skillKey ?? ''}
                      onChange={e => updateField(index, 'skillKey', e.target.value)}
                      placeholder="ex: classification_skill"
                      className="text-xs border rounded px-2 py-1 w-44"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">LLM:</label>
                    <input
                      type="text"
                      value={step.llmModel ?? ''}
                      onChange={e => updateField(index, 'llmModel', e.target.value)}
                      placeholder="ex: gpt-4o-mini"
                      className="text-xs border rounded px-2 py-1 w-36"
                    />
                  </div>
                </div>

                {/* Transitions section */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleTransitions(step.key)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {expandedTransitions[step.key] ? '▲ Ocultar transicoes' : '▼ Condicoes de transicao'}
                  </button>
                  {expandedTransitions[step.key] && step.id && (
                    <TransitionsEditor
                      stepId={step.id}
                      capabilityId={capabilityId}
                      steps={steps}
                    />
                  )}
                </div>
              </div>

              {/* isHumanRequired toggle + reorder buttons */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleHumanRequired(index)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    step.isHumanRequired
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {step.isHumanRequired ? 'Requer Humano' : 'Automatico'}
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    className="px-2 py-1 text-xs rounded border hover:bg-gray-50 disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
