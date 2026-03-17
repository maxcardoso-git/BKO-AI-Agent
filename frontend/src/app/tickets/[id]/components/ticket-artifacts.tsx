import type { Artifact } from '@/lib/types'

interface TicketArtifactsProps {
  artifacts: Artifact[]
}

export function TicketArtifacts({ artifacts }: TicketArtifactsProps) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Artefatos</h2>
      {artifacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum artefato ainda.</p>
      ) : (
        <ul className="space-y-3">
          {artifacts.map((artifact) => (
            <li key={artifact.id} className="rounded-md border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{artifact.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(artifact.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Tipo: {artifact.type}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
