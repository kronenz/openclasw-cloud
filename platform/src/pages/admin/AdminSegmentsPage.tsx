import { TrendingUp, TrendingDown, Users } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'

const segments = [
  {
    name: 'Champion',
    color: 'bg-green-500',
    count: 9,
    percentage: 38,
    avgHealthScore: 96,
    avgRevenue: '₩312,000',
    trend: 'up' as const,
  },
  {
    name: 'Potential Upsell',
    color: 'bg-blue-500',
    count: 6,
    percentage: 25,
    avgHealthScore: 87,
    avgRevenue: '₩98,000',
    trend: 'up' as const,
  },
  {
    name: 'New',
    color: 'bg-purple-500',
    count: 4,
    percentage: 17,
    avgHealthScore: 85,
    avgRevenue: '₩124,000',
    trend: 'neutral' as const,
  },
  {
    name: 'Need Attention',
    color: 'bg-yellow-500',
    count: 3,
    percentage: 12,
    avgHealthScore: 68,
    avgRevenue: '₩149,000',
    trend: 'down' as const,
  },
  {
    name: 'At Risk',
    color: 'bg-red-500',
    count: 2,
    percentage: 8,
    avgHealthScore: 42,
    avgRevenue: '₩149,000',
    trend: 'down' as const,
  },
  {
    name: 'Happy Inactive',
    color: 'bg-gray-400',
    count: 0,
    percentage: 0,
    avgHealthScore: 0,
    avgRevenue: '₩0',
    trend: 'neutral' as const,
  },
]

const segmentDetails = [
  { tenant: 'TechOffice', segment: 'Champion', healthScore: 98, lastActive: '2 min ago', riskFactors: 'None' },
  { tenant: 'Dental Clinic Plus', segment: 'Champion', healthScore: 96, lastActive: '5 min ago', riskFactors: 'None' },
  { tenant: 'Cafe Bloom', segment: 'Champion', healthScore: 95, lastActive: '8 min ago', riskFactors: 'None' },
  { tenant: 'FashionShop Korea', segment: 'New', healthScore: 91, lastActive: '12 min ago', riskFactors: 'None' },
  { tenant: 'Beauty Bar', segment: 'Potential Upsell', healthScore: 88, lastActive: '18 min ago', riskFactors: 'Low usage' },
  { tenant: 'FoodGarden', segment: 'New', healthScore: 82, lastActive: '25 min ago', riskFactors: 'None' },
  { tenant: 'ShopMall A', segment: 'Need Attention', healthScore: 72, lastActive: '1 hour ago', riskFactors: 'High latency, Near token limit' },
  { tenant: 'BookStore', segment: 'At Risk', healthScore: 45, lastActive: '2 hours ago', riskFactors: 'Multiple failures, Payment overdue' },
]

export function AdminSegmentsPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Customer Segments" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Segment Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map((segment, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${segment.color}`}></div>
                    <h3 className="text-base font-semibold text-gray-900">{segment.name}</h3>
                  </div>
                  {segment.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
                  {segment.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
                </div>
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{segment.count}</span>
                    <span className="text-sm text-gray-500">tenants ({segment.percentage}%)</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Health Score</span>
                      <span className="font-medium text-gray-900">{segment.avgHealthScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg Revenue</span>
                      <span className="font-medium text-gray-900">{segment.avgRevenue}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Segment Distribution Chart */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Segment Distribution</h3>
            <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
              <div className="text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Recharts pie chart</p>
                <p className="text-xs mt-1">Customer segment breakdown</p>
              </div>
            </div>
          </div>

          {/* Segment Trends */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-semibold text-gray-900">Improving</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">TechOffice</span>
                  <span className="text-xs text-green-600 font-medium">+8 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Cafe Bloom</span>
                  <span className="text-xs text-green-600 font-medium">+5 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">FashionShop Korea</span>
                  <span className="text-xs text-green-600 font-medium">+3 pts</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-semibold text-gray-900">Declining</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">BookStore</span>
                  <span className="text-xs text-red-600 font-medium">-18 pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">ShopMall A</span>
                  <span className="text-xs text-red-600 font-medium">-12 pts</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-gray-900">Segment Moves</h3>
              </div>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-gray-700">Beauty Bar</span>
                  <div className="text-xs text-gray-500 mt-0.5">New → Potential Upsell</div>
                </div>
                <div className="text-sm">
                  <span className="text-gray-700">BookStore</span>
                  <div className="text-xs text-gray-500 mt-0.5">Need Attention → At Risk</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Segment Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Tenant Segment Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Health Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Risk Factors
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {segmentDetails.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.tenant}</td>
                      <td className="px-6 py-3">
                        <StatusBadge
                          status={item.segment}
                          variant={
                            item.segment === 'Champion'
                              ? 'success'
                              : item.segment === 'At Risk'
                              ? 'error'
                              : item.segment === 'Need Attention'
                              ? 'warning'
                              : 'info'
                          }
                        />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-16">
                            <div
                              className={`h-full ${
                                item.healthScore >= 90
                                  ? 'bg-green-500'
                                  : item.healthScore >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${item.healthScore}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">{item.healthScore}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{item.lastActive}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {item.riskFactors === 'None' ? (
                          <span className="text-gray-400">None</span>
                        ) : (
                          <span className="text-red-600">{item.riskFactors}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
