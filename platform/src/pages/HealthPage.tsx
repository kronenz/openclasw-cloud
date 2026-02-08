import { RefreshCw, CheckCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'

export function HealthPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="System Health">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Overall Status Banner */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900">All Systems Operational</p>
              <p className="text-xs text-green-700 mt-0.5">
                All services are running normally. Last checked: 2 minutes ago
              </p>
            </div>
          </div>

          {/* Service Status Cards */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* API Workers */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">API Workers</h3>
                  <StatusBadge status="Healthy" variant="success" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-medium text-gray-900">12ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-medium text-gray-900">99.9%</span>
                  </div>
                </div>
              </div>

              {/* D1 Database */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">D1 Database</h3>
                  <StatusBadge status="Healthy" variant="success" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-medium text-gray-900">8ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-medium text-gray-900">99.9%</span>
                  </div>
                </div>
              </div>

              {/* R2 Storage */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">R2 Storage</h3>
                  <StatusBadge status="Healthy" variant="success" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-medium text-gray-900">45ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-medium text-gray-900">99.9%</span>
                  </div>
                </div>
              </div>

              {/* KV Cache */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">KV Cache</h3>
                  <StatusBadge status="Healthy" variant="success" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-medium text-gray-900">3ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Uptime</span>
                    <span className="font-medium text-gray-900">99.9%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Health */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Tenant Health</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Open Incidents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Checked
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Recovery Attempts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">TechOffice</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Healthy" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">0</td>
                  <td className="px-6 py-3 text-sm text-gray-500">2 min ago</td>
                  <td className="px-6 py-3 text-sm text-gray-500">0</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">Cafe Bloom</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Degraded" variant="warning" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">1</td>
                  <td className="px-6 py-3 text-sm text-gray-500">1 min ago</td>
                  <td className="px-6 py-3 text-sm text-gray-500">2</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">FoodGarden</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Healthy" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">0</td>
                  <td className="px-6 py-3 text-sm text-gray-500">3 min ago</td>
                  <td className="px-6 py-3 text-sm text-gray-500">0</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">ShopMall A</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Healthy" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">0</td>
                  <td className="px-6 py-3 text-sm text-gray-500">2 min ago</td>
                  <td className="px-6 py-3 text-sm text-gray-500">0</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">BookStore</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Unhealthy" variant="error" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">2</td>
                  <td className="px-6 py-3 text-sm text-gray-500">5 min ago</td>
                  <td className="px-6 py-3 text-sm text-gray-500">5</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recent Incidents */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Recent Incidents</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">#INC-001</td>
                  <td className="px-6 py-3 text-sm text-gray-800">BookStore</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                      P0
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Investigating" variant="warning" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">AI Gateway timeout</td>
                  <td className="px-6 py-3 text-sm text-gray-500">5 min ago</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">#INC-002</td>
                  <td className="px-6 py-3 text-sm text-gray-800">Cafe Bloom</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                      P1
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Resolved" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">High latency detected</td>
                  <td className="px-6 py-3 text-sm text-gray-500">15 min ago</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">#INC-003</td>
                  <td className="px-6 py-3 text-sm text-gray-800">ShopMall A</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                      P2
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Resolved" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-800">Token limit exceeded</td>
                  <td className="px-6 py-3 text-sm text-gray-500">2 hours ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
