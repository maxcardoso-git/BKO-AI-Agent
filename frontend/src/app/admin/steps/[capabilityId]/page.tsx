import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import Link from 'next/link'
import { StepsDesigner } from './components/steps-designer'

interface PageProps {
  params: Promise<{ capabilityId: string }>
}

interface StepDefinition {
  id: string
  key: string
  name: string
  stepOrder: number
  isHumanRequired: boolean
  isActive: boolean
  skillKey: string | null
  llmModel: string | null
}

interface CapabilityVersionDetail {
  id: string
  name: string
  isCurrent: boolean
  stepDefinitions: StepDefinition[]
}

interface CapabilityWithVersions {
  id: string
  name: string
  versions: CapabilityVersionDetail[]
}

export default async function CapabilityDesignerPage({ params }: PageProps) {
  await verifySession()
  const { capabilityId } = await params

  const capRes = await fetchAuthAPI('/api/admin/capabilities')
  if (!capRes.ok) notFound()

  const capabilities: CapabilityWithVersions[] = await capRes.json()
  const capability = capabilities.find(c => c.id === capabilityId)
  if (!capability) notFound()

  // Use the current/active version, fallback to first
  const version = capability.versions?.find(v => v.isCurrent) ?? capability.versions?.[0]
  if (!version) {
    return (
      <main className="mx-auto max-w-screen-xl px-4 py-8">
        <Link href="/admin/steps" className="text-sm text-blue-600 hover:underline mb-4 block">← Voltar</Link>
        <h1 className="text-xl font-semibold">{capability.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">Nenhuma versao ativa encontrada para esta capability.</p>
      </main>
    )
  }

  // Load full version detail with steps ordered by stepOrder
  const versionRes = await fetchAuthAPI(`/api/admin/capabilities/${capabilityId}/versions/${version.id}`)
  const versionDetail: CapabilityVersionDetail = versionRes.ok ? await versionRes.json() : version

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <Link href="/admin/steps" className="text-sm text-blue-600 hover:underline mb-4 block">← Voltar aos Fluxos</Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">{capability.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Versao ativa: {versionDetail.name} — {versionDetail.stepDefinitions?.length ?? 0} steps
        </p>
      </div>

      <StepsDesigner
        capabilityId={capabilityId}
        versionId={versionDetail.id}
        initialSteps={versionDetail.stepDefinitions ?? []}
      />
    </main>
  )
}
