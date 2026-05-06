import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CapabilityVersion {
  id: string
  name: string
  isCurrent: boolean
  isActive: boolean
  stepDefinitions?: Array<{ id: string; stepOrder: number; key: string }>
}

interface Capability {
  id: string
  name: string
  tipologiaId: string | null
  versions: CapabilityVersion[]
}

export default async function StepsAdminPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/capabilities')
  const capabilities: Capability[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Designer de Fluxos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os fluxos de steps por capability. Clique em uma capability para editar os steps.
        </p>
      </div>

      {capabilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma capability encontrada.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(cap => {
            const currentVersion = cap.versions?.find(v => v.isCurrent) ?? cap.versions?.[0]
            return (
              <Link key={cap.id} href={`/admin/steps/${cap.id}`} className="block hover:no-underline">
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <h2 className="font-medium">{cap.name}</h2>
                    {currentVersion?.isCurrent && (
                      <Badge variant="outline" className="text-xs">Atual</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentVersion?.stepDefinitions?.length ?? 0} steps configurados
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Versao: {currentVersion?.name ?? '—'}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
