'use client'
import { useState } from 'react'
import { useActionState } from 'react'   // from 'react', NOT 'react-dom'
import dynamic from 'next/dynamic'
import { submitHumanReview } from '../actions'
import type { ReviewActionState } from '../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

// react-diff-viewer-continued is client-only — lazy load to avoid SSR issues
const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), { ssr: false })

interface ChecklistItem {
  fieldName: string
  fieldLabel: string
  isRequired: boolean
}

interface ExistingReview {
  id: string
  status: string
  humanFinalText: string | null
  checklistItems: Record<string, boolean> | null
  observations: string | null
}

interface Props {
  execId: string
  stepExecId: string
  complaintId: string
  aiDraft: string
  checklistTemplate: ChecklistItem[]
  existingReview: ExistingReview | null
}

export function HitlEditor({ execId, stepExecId, complaintId, aiDraft, checklistTemplate, existingReview }: Props) {
  const [humanDraft, setHumanDraft] = useState(existingReview?.humanFinalText ?? aiDraft)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    existingReview?.checklistItems ?? {}
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submitAction = submitHumanReview.bind(null, execId, stepExecId, complaintId) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, formAction, isPending] = useActionState<ReviewActionState, FormData>(submitAction, {} as ReviewActionState)

  const isAlreadyApproved = existingReview?.status === 'approved'

  // Checklist completion check: all required items must be checked
  const requiredItems = checklistTemplate.filter(i => i.isRequired)
  const allRequiredChecked = requiredItems.every(i => checkedItems[i.fieldName] === true)
  const canApprove = allRequiredChecked && !isAlreadyApproved

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden field for humanFinalText — updated by textarea onChange via state */}
      <input type="hidden" name="humanFinalText" value={humanDraft} />

      {isAlreadyApproved && (
        <div className="rounded bg-green-50 border border-green-200 p-4 text-green-800 text-sm font-medium">
          Esta revisao ja foi aprovada.
        </div>
      )}

      <Tabs defaultValue="ai" className="w-full">
        <TabsList>
          <TabsTrigger value="ai">Texto IA</TabsTrigger>
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="diff">Comparacao</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Texto Gerado pela IA (somente leitura)</h3>
            <pre className="text-sm whitespace-pre-wrap bg-gray-50 rounded p-3 min-h-[200px]">
              {aiDraft || 'Nenhum texto gerado.'}
            </pre>
          </Card>
        </TabsContent>

        <TabsContent value="edit">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Editar Resposta Final</h3>
            <Textarea
              value={humanDraft}
              onChange={e => setHumanDraft(e.target.value)}
              rows={12}
              placeholder="Edite a resposta aqui..."
              className="font-mono text-sm"
              disabled={isAlreadyApproved}
            />
          </Card>
        </TabsContent>

        <TabsContent value="diff">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-2">Comparacao: IA vs Revisao Humana</h3>
            {/* ReactDiffViewer is dynamically imported — no SSR */}
            <ReactDiffViewer
              oldValue={aiDraft}
              newValue={humanDraft}
              splitView={true}
              useDarkTheme={false}
              showDiffOnly={false}
              leftTitle="Texto IA"
              rightTitle="Revisao Humana"
            />
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Checklist Regulatorio</h3>
            {checklistTemplate.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item de checklist disponivel.</p>
            ) : (
              <div className="space-y-3">
                {checklistTemplate.map(item => (
                  <div key={item.fieldName} className="flex items-center gap-3">
                    <Checkbox
                      id={`checklist_${item.fieldName}`}
                      name={`checklist_${item.fieldName}`}
                      checked={checkedItems[item.fieldName] ?? false}
                      onCheckedChange={checked =>
                        setCheckedItems(prev => ({ ...prev, [item.fieldName]: checked === true }))
                      }
                      disabled={isAlreadyApproved}
                    />
                    <label htmlFor={`checklist_${item.fieldName}`} className="text-sm cursor-pointer">
                      {item.fieldLabel}
                      {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                ))}
                {requiredItems.length > 0 && !allRequiredChecked && (
                  <p className="text-xs text-amber-700 mt-2">Complete todos os itens obrigatorios (*) para aprovar.</p>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Correction reason */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Motivo da Correcao <span className="text-muted-foreground">(opcional)</span></label>
        <Textarea
          name="correctionReason"
          rows={3}
          placeholder="Descreva o motivo da correcao (sera usado para aprendizado do sistema)..."
          disabled={isAlreadyApproved}
        />
      </Card>

      {/* Observations */}
      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Observacoes <span className="text-muted-foreground">(opcional)</span></label>
        <Textarea
          name="observations"
          rows={3}
          placeholder="Observacoes adicionais sobre esta revisao..."
          disabled={isAlreadyApproved}
        />
      </Card>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      {!isAlreadyApproved && (
        <Button
          type="submit"
          disabled={isPending || !canApprove}
          className="w-full sm:w-auto"
        >
          {isPending ? 'Aprovando...' : 'Aprovar Resposta Final'}
        </Button>
      )}
      {!canApprove && !isAlreadyApproved && requiredItems.length > 0 && (
        <p className="text-xs text-muted-foreground">Complete o checklist regulatorio para habilitar a aprovacao.</p>
      )}
    </form>
  )
}
