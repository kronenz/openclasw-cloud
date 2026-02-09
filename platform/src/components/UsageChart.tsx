import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipProps } from 'recharts'

type Period = '7D' | '30D' | '90D'

interface UsageDataPoint {
  date: string
  tokens: number
}

// Generate mock time-series data for demonstration
function generateMockData(days: number): UsageDataPoint[] {
  const data: UsageDataPoint[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

    // Generate realistic-looking token usage with some variation
    const baseUsage = 50000
    const variation = Math.random() * 30000
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.6 : 1
    const tokens = Math.floor((baseUsage + variation) * weekendFactor)

    data.push({
      date: dateStr,
      tokens,
    })
  }

  return data
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-semibold text-blue-600">
          {payload[0].value.toLocaleString()} tokens
        </p>
      </div>
    )
  }
  return null
}

export function UsageChart() {
  const [period, setPeriod] = useState<Period>('7D')

  const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
  const data = generateMockData(days)

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">Token Usage</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod('7D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              period === '7D'
                ? 'text-gray-600 bg-gray-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            7D
          </button>
          <button
            onClick={() => setPeriod('30D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              period === '30D'
                ? 'text-gray-600 bg-gray-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            30D
          </button>
          <button
            onClick={() => setPeriod('90D')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              period === '90D'
                ? 'text-gray-600 bg-gray-100'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            90D
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={256}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value: number) => `${Math.floor(value / 1000)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorTokens)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
