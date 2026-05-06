import { fetchAuthAPI } from '@/lib/api'
import { verifySession } from '@/lib/dal'
import { Badge } from '@/components/ui/badge'
import { EditModelForm } from './edit-model-form'

interface LlmModelConfig {
  id: string
  functionalityType: string
  provider: string
  modelId: string
  temperature: number
  maxTokens: number | null
  isActive: boolean
}

export default async function ModelsPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/models')
  const models: LlmModelConfig[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Modelos LLM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os modelos de linguagem por funcionalidade.
        </p>
      </div>

      {models.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum modelo encontrado.</p>
      ) : (
        <div className="space-y-4">
          {models.map(m => (
            <div key={m.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{m.functionalityType}</span>
                  <span className="text-xs text-muted-foreground">{m.provider}</span>
                  <Badge variant={m.isActive ? 'default' : 'outline'}>
                    {m.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              <EditModelForm id={m.id} model={m} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
