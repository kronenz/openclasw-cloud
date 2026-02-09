import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TooltipProps } from 'recharts'

type Period = '7D' | '30D' | '90D'

interface MetricsDataPoint {
  date: string
  requests: number
  latency: number
  errorRate: number
}

// Generate mock platform metrics data
function generateMetricsData(days: number): MetricsDataPoint[] {
  const data: MetricsDataPoint[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

    // Generate realistic metrics
    const baseRequests = 12000
    const requestVariation = Math.random() * 3000
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.7 : 1

    data.push({
      date: dateStr,
      requests: Math.floor((baseRequests + requestVariation) * weekendFactor),
      latency: Math.floor(80 + Math.random() * 40), // 80-120ms
      errorRate: parseFloat((0.1 + Math.random() * 0.3).toFixed(2)), // 0.1-0.4%
    })
  }

  return data
}

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    name: string
    color: string
  }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-xs text-gray-500 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-600">{entry.name}:</span>
              <span className="text-xs font-semibold" style={{ color: entry.color }}>
                {entry.dataKey === 'requests'
                  ? entry.value.toLocaleString()
                  : entry.dataKey === 'latency'
                  ? `${entry.value}ms`
                  : `${entry.value}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

interface PlatformMetricsChartProps {
  className?: string
}

export function PlatformMetricsChart({ className = '' }: PlatformMetricsChartProps) {
  const [period, setPeriod] = useState<Period>('7D')

  const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
  const data = generateMetricsData(days)

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-gray-900">Platform Metrics</h3>
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
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value: number) => `${Math.floor(value / 1000)}K`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            iconType="circle"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="latency"
            name="Latency (ms)"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="errorRate"
            name="Error Rate (%)"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
