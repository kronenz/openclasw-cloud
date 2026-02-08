import { Plus, Search, Eye, Pause, Trash2, Download } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'

const tenants = [
  {
    id: 'tenant-001',
    name: 'TechOffice',
    plan: 'Enterprise',
    status: 'Active',
    segment: 'Champion',
    healthScore: 98,
    monthlyUsage: '1.2M',
    revenue: '₩490,000',
  },
  {
    id: 'tenant-002',
    name: 'Cafe Bloom',
    plan: 'Growth',
    status: 'Active',
    segment: 'Champion',
    healthScore: 95,
    monthlyUsage: '487K',
    revenue: '₩149,000',
  },
  {
    id: 'tenant-003',
    name: 'ShopMall A',
    plan: 'Growth',
    status: 'Degraded',
    segment: 'Need Attention',
    healthScore: 72,
    monthlyUsage: '892K',
    revenue: '₩149,000',
  },
  {
    id: 'tenant-004',
    name: 'Beauty Bar',
    plan: 'Starter',
    status: 'Active',
    segment: 'Potential Upsell',
    healthScore: 88,
    monthlyUsage: '98K',
    revenue: '₩49,000',
  },
  {
    id: 'tenant-005',
    name: 'FoodGarden',
    plan: 'Starter',
    status: 'Active',
    segment: 'New',
    healthScore: 82,
    monthlyUsage: '45K',
    revenue: '₩49,000',
  },
  {
    id: 'tenant-006',
    name: 'BookStore',
    plan: 'Growth',
    status: 'Unhealthy',
    segment: 'At Risk',
    healthScore: 45,
    monthlyUsage: '234K',
    revenue: '₩149,000',
  },
  {
    id: 'tenant-007',
    name: 'FashionShop Korea',
    plan: 'Growth',
    status: 'Active',
    segment: 'New',
    healthScore: 91,
    monthlyUsage: '567K',
    revenue: '₩149,000',
  },
  {
    id: 'tenant-008',
    name: 'Dental Clinic Plus',
    plan: 'Enterprise',
    status: 'Active',
    segment: 'Champion',
    healthScore: 96,
    monthlyUsage: '1.8M',
    revenue: '₩490,000',
  },
]

export function AdminTenantsPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Tenant Management">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Provision New Tenant
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tenants..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <select className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Segments</option>
                  <option>Champion</option>
                  <option>Potential Upsell</option>
                  <option>New</option>
                  <option>Need Attention</option>
                  <option>At Risk</option>
                </select>
                <select className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Plans</option>
                  <option>Starter</option>
                  <option>Growth</option>
                  <option>Enterprise</option>
                </select>
                <select className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Degraded</option>
                  <option>Unhealthy</option>
                  <option>Suspended</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Health Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Monthly Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </td>
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{tenant.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{tenant.plan}</td>
                      <td className="px-6 py-3">
                        <StatusBadge
                          status={tenant.status}
                          variant={
                            tenant.status === 'Active'
                              ? 'success'
                              : tenant.status === 'Degraded'
                              ? 'warning'
                              : 'error'
                          }
                        />
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-xs font-medium ${
                            tenant.segment === 'Champion'
                              ? 'text-green-700'
                              : tenant.segment === 'Potential Upsell'
                              ? 'text-blue-700'
                              : tenant.segment === 'New'
                              ? 'text-purple-700'
                              : tenant.segment === 'Need Attention'
                              ? 'text-yellow-700'
                              : 'text-red-700'
                          }`}
                        >
                          {tenant.segment}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-16">
                            <div
                              className={`h-full ${
                                tenant.healthScore >= 90
                                  ? 'bg-green-500'
                                  : tenant.healthScore >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${tenant.healthScore}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">
                            {tenant.healthScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 font-mono">{tenant.monthlyUsage}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{tenant.revenue}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-yellow-600 hover:bg-yellow-50 rounded">
                            <Pause className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bulk Actions Bar */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">0 selected</div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Suspend Selected
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">Showing 1 to 8 of 24 tenants</div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm font-medium text-gray-400 bg-white border border-gray-300 rounded-md cursor-not-allowed">
                  Previous
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md">
                  1
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  2
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  3
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
