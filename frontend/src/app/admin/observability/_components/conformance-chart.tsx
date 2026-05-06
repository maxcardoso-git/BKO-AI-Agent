'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

interface ConformanceDataItem {
  tipology_key: string
  avg_compliance_score: string
  evaluated_count: number | string
}

interface Props {
  data: ConformanceDataItem[]
}

const chartConfig = {
  avg_compliance_score: {
    label: 'Score Médio de Conformidade',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig

export function ConformanceChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de conformidade disponíveis.</p>
  }

  const chartData = data.map((d) => ({
    ...d,
    avg_compliance_score: parseFloat(d.avg_compliance_score),
  }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="tipology_key"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
        />
        <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar dataKey="avg_compliance_score" name="Score de Conformidade" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
