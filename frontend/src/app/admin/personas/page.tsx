import { fetchAuthAPI } from '@/lib/api'
import { verifySession } from '@/lib/dal'
import { Badge } from '@/components/ui/badge'
import { CreatePersonaForm } from './create-persona-form'
import { DeletePersonaButton } from './delete-persona-button'

interface Persona {
  id: string
  name: string
  tipologyId: string | null
  formalityLevel: number
  empathyLevel: number
  assertivenessLevel: number
  requiredExpressions: string[] | null
  forbiddenExpressions: string[] | null
  isActive: boolean
}

export default async function PersonasPage() {
  await verifySession()

  const res = await fetchAuthAPI('/api/admin/personas')
  const personas: Persona[] = res.ok ? await res.json() : []

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Personas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as personas de comunicacao por tipologia.
        </p>
      </div>

      {/* Persona list */}
      <div className="overflow-x-auto rounded-md border mb-8">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Nome</th>
              <th className="px-4 py-2 text-left font-medium">Tipologia</th>
              <th className="px-4 py-2 text-left font-medium">Formalidade</th>
              <th className="px-4 py-2 text-left font-medium">Empatia</th>
              <th className="px-4 py-2 text-left font-medium">Assertividade</th>
              <th className="px-4 py-2 text-left font-medium">Expressoes Requeridas</th>
              <th className="px-4 py-2 text-left font-medium">Expressoes Proibidas</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {personas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-center text-muted-foreground">
                  Nenhuma persona encontrada.
                </td>
              </tr>
            ) : (
              personas.map(p => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.tipologyId ?? 'global'}</td>
                  <td className="px-4 py-2">{p.formalityLevel}/5</td>
                  <td className="px-4 py-2">{p.empathyLevel}/5</td>
                  <td className="px-4 py-2">{p.assertivenessLevel}/5</td>
                  <td className="px-4 py-2">{p.requiredExpressions?.length ?? 0}</td>
                  <td className="px-4 py-2">{p.forbiddenExpressions?.length ?? 0}</td>
                  <td className="px-4 py-2">
                    <Badge variant={p.isActive ? 'default' : 'outline'}>
                      {p.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <DeletePersonaButton id={p.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Persona form */}
      <div className="max-w-lg">
        <h2 className="text-base font-semibold mb-4">Adicionar Persona</h2>
        <CreatePersonaForm />
      </div>
    </main>
  )
}
