'use client'

import { EquityPoint } from '@/types'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

interface Props {
  data: EquityPoint[]
}

export default function EquityChart({ data }: Props) {
  const chartData = data.map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString('en-IN', {
      month: 'short',
      year: '2-digit',
    }),
    equity: Math.round(d.equity),
    drawdown: -d.drawdown,
  }))

  const minEq = Math.min(...data.map((d) => d.equity))
  const maxEq = Math.max(...data.map((d) => d.equity))
  const initial = data[0]?.equity || 0

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minEq * 0.95, maxEq * 1.05]}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={(v: number) => `\u20B9${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e1e2e',
              border: '1px solid #374151',
              borderRadius: 8,
            }}
            formatter={(value: number) => [
              `\u20B9${value.toLocaleString('en-IN')}`,
              'Equity',
            ]}
          />
          <ReferenceLine y={initial} stroke="#6b7280" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#3b82f6"
            fill="url(#eqGrad)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e1e2e',
              border: '1px solid #374151',
              borderRadius: 8,
            }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="rgba(239,68,68,0.1)"
            strokeWidth={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
