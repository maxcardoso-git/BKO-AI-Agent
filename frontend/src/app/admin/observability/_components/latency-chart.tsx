'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

interface LatencyDataItem {
  step_key: string
  avg_latency_ms: number | string
  error_count: number | string
}

interface Props {
  data: LatencyDataItem[]
}

const chartConfig = {
  avg_latency_ms: {
    label: 'Latência Média (ms)',
    color: 'hsl(var(--chart-1))',
  },
  error_count: {
    label: 'Erros',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

export function LatencyBarChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sem dados nos últimos 30 dias.</p>
  }

  const chartData = data.map((d) => ({
    ...d,
    avg_latency_ms: Number(d.avg_latency_ms),
    error_count: Number(d.error_count),
  }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="step_key"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '\u2026' : v}
        />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar dataKey="avg_latency_ms" name="Lat\u00eancia M\u00e9dia (ms)" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
        <Bar dataKey="error_count" name="Erros" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
