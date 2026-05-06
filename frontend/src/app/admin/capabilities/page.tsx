import { fetchAuthAPI } from '@/lib/api'
import { verifySession } from '@/lib/dal'
import { Badge } from '@/components/ui/badge'
import { ToggleCapabilityButton } from './toggle-capability-button'

interface CapabilityVersion {
  id: string
  version: number
  description: string | null
  isActive: boolean
  isCurrent: boolean
  capabilityId: string
}

export default async function CapabilitiesPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/capability-versions')
  const versions: CapabilityVersion[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Capabilities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as versoes de capability do sistema.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">ID da Capability</th>
              <th className="px-4 py-2 text-left font-medium">Versao</th>
              <th className="px-4 py-2 text-left font-medium">Descricao</th>
              <th className="px-4 py-2 text-left font-medium">Atual</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">
                  Nenhuma capability encontrada.
                </td>
              </tr>
            ) : (
              versions.map(v => (
                <tr key={v.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {v.capabilityId.substring(0, 8)}…
                  </td>
                  <td className="px-4 py-2 font-medium">v{v.version}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{v.description ?? '—'}</td>
                  <td className="px-4 py-2">
                    {v.isCurrent && <Badge variant="outline" className="text-xs">Atual</Badge>}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={v.isActive ? 'default' : 'outline'}>
                      {v.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <ToggleCapabilityButton id={v.id} isActive={v.isActive} />
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
