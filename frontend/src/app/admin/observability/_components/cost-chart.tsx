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

interface CostDataItem {
  complaintId: string
  total_cost_usd: string
  total_tokens: number | string
}

interface Props {
  data: CostDataItem[]
}

const chartConfig = {
  total_cost_usd: {
    label: 'Custo Total (USD)',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

export function CostBarChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sem dados de custo disponíveis.</p>
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.complaintId.slice(0, 8),
    total_cost_usd: parseFloat(d.total_cost_usd),
  }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
        />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total_cost_usd" name="Custo (USD)" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
