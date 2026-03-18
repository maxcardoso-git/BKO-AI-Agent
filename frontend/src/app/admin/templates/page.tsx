import { fetchAuthAPI } from '@/lib/api'
import { verifySession } from '@/lib/dal'
import { EditTemplateForm } from './edit-template-form'

interface ResponseTemplate {
  id: string
  name: string
  tipologyId: string | null
  situationId: string | null
  templateContent: string
  version: number
  isActive: boolean
}

export default async function TemplatesPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/templates')
  const templates: ResponseTemplate[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Templates de Resposta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edite os templates de resposta por tipologia e situacao.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum template encontrado.</p>
      ) : (
        <div className="space-y-4">
          {templates.map(t => (
            <div key={t.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-medium text-sm">{t.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">v{t.version}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.templateContent.length} chars
                </div>
              </div>
              <EditTemplateForm id={t.id} currentContent={t.templateContent} />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
