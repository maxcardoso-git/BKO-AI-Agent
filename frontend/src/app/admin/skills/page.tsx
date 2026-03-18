import { fetchAuthAPI } from '@/lib/api'
import { verifySession } from '@/lib/dal'
import { Badge } from '@/components/ui/badge'
import { ToggleSkillButton } from './toggle-skill-button'

interface SkillDefinition {
  id: string
  key: string
  name: string
  description: string | null
  version: string
  isActive: boolean
}

export default async function SkillsPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/skills')
  const skills: SkillDefinition[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ative ou desative skills do pipeline de processamento.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Chave</th>
              <th className="px-4 py-2 text-left font-medium">Nome</th>
              <th className="px-4 py-2 text-left font-medium">Descricao</th>
              <th className="px-4 py-2 text-left font-medium">Versao</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {skills.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                  Nenhuma skill encontrada.
                </td>
              </tr>
            ) : (
              skills.map(s => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{s.key}</td>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{s.description ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{s.version}</td>
                  <td className="px-4 py-2">
                    <Badge variant={s.isActive ? 'default' : 'outline'}>
                      {s.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <ToggleSkillButton id={s.id} isActive={s.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
