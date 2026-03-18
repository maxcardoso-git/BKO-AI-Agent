import { verifySession } from '@/lib/dal'
import { fetchAuthAPI } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { LatencyBarChart } from './_components/latency-chart'
import { CostBarChart } from './_components/cost-chart'
import { ConformanceChart } from './_components/conformance-chart'

interface LatencyItem {
  step_key: string
  avg_latency_ms: number
  error_count: number
}

interface CostItem {
  complaintId: string
  total_cost_usd: string
  total_tokens: number
}

interface ErrorRateItem {
  step_key: string
  total: string
  errors: string
  error_rate_pct: string
}

interface HitlRate {
  hitl_count: string
  total_count: string
  hitl_rate_pct: string
}

interface ConformanceItem {
  tipology_key: string
  tipology_name: string
  avg_compliance_score: string
  evaluated_count: string
}

interface TokenTotals {
  total_tokens: string
  prompt_tokens: string
  completion_tokens: string
  total_cost_usd: string
  total_calls: string
}

export default async function ObservabilityPage() {
  await verifySession()

  const [
    latencyRes,
    costRes,
    errorRateRes,
    hitlRes,
    conformanceRes,
    tokensRes,
  ] = await Promise.all([
    fetchAuthAPI('/api/admin/observability/latency'),
    fetchAuthAPI('/api/admin/observability/cost'),
    fetchAuthAPI('/api/admin/observability/error-rate'),
    fetchAuthAPI('/api/admin/observability/hitl-rate'),
    fetchAuthAPI('/api/admin/observability/conformance'),
    fetchAuthAPI('/api/admin/observability/tokens'),
  ])

  const latencyData: LatencyItem[] = latencyRes.ok ? await latencyRes.json() : []
  const costData: CostItem[] = costRes.ok ? await costRes.json() : []
  const errorRateData: ErrorRateItem[] = errorRateRes.ok ? await errorRateRes.json() : []
  const hitlData: HitlRate = hitlRes.ok
    ? await hitlRes.json()
    : { hitl_count: '0', total_count: '0', hitl_rate_pct: '0.00' }
  const conformanceData: ConformanceItem[] = conformanceRes.ok ? await conformanceRes.json() : []
  const tokenTotals: TokenTotals = tokensRes.ok
    ? await tokensRes.json()
    : { total_tokens: '0', prompt_tokens: '0', completion_tokens: '0', total_cost_usd: '0.0000', total_calls: '0' }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Observabilidade Operacional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas de latência, custo, erros, HITL, conformidade e uso de tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel 1 — Latency by step */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Latência Média por Skill</h2>
          <LatencyBarChart data={latencyData} />
        </Card>

        {/* Panel 2 — Cost by ticket */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Custo por Ticket (Top 50)</h2>
          <CostBarChart data={costData} />
        </Card>

        {/* Panel 3 — Conformance by tipologia */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Conformidade por Tipologia</h2>
          <ConformanceChart data={conformanceData} />
        </Card>

        {/* Panel 4 — Error rate table */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Taxa de Erro por Skill</h2>
          {errorRateData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados disponíveis.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-2">Skill</th>
                    <th className="text-right py-1 pr-2">Total</th>
                    <th className="text-right py-1 pr-2">Erros</th>
                    <th className="text-right py-1">Taxa (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRateData.map((row) => (
                    <tr key={row.step_key} className="border-b last:border-0">
                      <td className="py-1 pr-2 font-mono">{row.step_key}</td>
                      <td className="py-1 pr-2 text-right">{row.total}</td>
                      <td className="py-1 pr-2 text-right">{row.errors}</td>
                      <td className="py-1 text-right">
                        <span className={parseFloat(row.error_rate_pct) > 10 ? 'text-red-600 font-medium' : ''}>
                          {row.error_rate_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Panel 5 — HITL rate */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Taxa HITL</h2>
          <div className="flex flex-col gap-2">
            <p className="text-3xl font-bold">
              {hitlData.hitl_rate_pct}%
            </p>
            <p className="text-xs text-muted-foreground">
              {hitlData.hitl_count} intervenções humanas de {hitlData.total_count} total de steps
            </p>
          </div>
        </Card>

        {/* Panel 6 — Token totals */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Uso de Tokens / Custo Total</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total de Tokens</p>
              <p className="font-semibold">{Number(tokenTotals.total_tokens).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Custo Total (USD)</p>
              <p className="font-semibold">${tokenTotals.total_cost_usd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens Prompt</p>
              <p className="font-semibold">{Number(tokenTotals.prompt_tokens).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens Completado</p>
              <p className="font-semibold">{Number(tokenTotals.completion_tokens).toLocaleString('pt-BR')}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Total de Chamadas LLM</p>
              <p className="font-semibold">{Number(tokenTotals.total_calls).toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </Card>

      </div>
    </main>
  )
}
