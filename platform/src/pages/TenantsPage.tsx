import { useState } from 'react'
import { Plus, Search, Filter, ArrowUpDown, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'
import { useApi } from '@/hooks/useApi'

const mockTenants = [
  {
    id: 'cafe-bloom',
    name: 'Cafe Bloom',
    subdomain: 'cafe-bloom.openclaw.ai',
    initials: 'CB',
    initialsColor: 'bg-blue-100 text-blue-700',
    plan: 'Growth',
    planColor: 'bg-blue-50 text-blue-700',
    status: 'Active',
    statusVariant: 'success' as const,
    usage: 42,
    revenue: '₩149,000',
    created: '2026-01-15',
  },
  {
    id: 'techoffice',
    name: 'TechOffice',
    subdomain: 'techoffice.openclaw.ai',
    initials: 'TO',
    initialsColor: 'bg-purple-100 text-purple-700',
    plan: 'Enterprise',
    planColor: 'bg-purple-50 text-purple-700',
    status: 'Active',
    statusVariant: 'success' as const,
    usage: 78,
    revenue: '₩490,000',
    created: '2026-01-08',
  },
  {
    id: 'shopmall-a',
    name: 'ShopMall A',
    subdomain: 'shopmall-a.openclaw.ai',
    initials: 'SA',
    initialsColor: 'bg-orange-100 text-orange-700',
    plan: 'Growth',
    planColor: 'bg-blue-50 text-blue-700',
    status: 'Active',
    statusVariant: 'success' as const,
    usage: 85,
    revenue: '₩149,000',
    created: '2026-01-22',
  },
  {
    id: 'beauty-bar',
    name: 'Beauty Bar',
    subdomain: 'beauty-bar.openclaw.ai',
    initials: 'BB',
    initialsColor: 'bg-pink-100 text-pink-700',
    plan: 'Starter',
    planColor: 'bg-gray-100 text-gray-700',
    status: 'Active',
    statusVariant: 'success' as const,
    usage: 18,
    revenue: '₩49,000',
    created: '2026-02-01',
  },
  {
    id: 'foodgarden',
    name: 'FoodGarden',
    subdomain: 'foodgarden.openclaw.ai',
    initials: 'FG',
    initialsColor: 'bg-gray-100 text-gray-500',
    plan: 'Starter',
    planColor: 'bg-gray-100 text-gray-600',
    status: 'Suspended',
    statusVariant: 'error' as const,
    usage: 0,
    revenue: '₩0',
    created: '2025-12-10',
  },
  {
    id: 'seoul-gym',
    name: 'Seoul Gym',
    subdomain: 'seoul-gym.openclaw.ai',
    initials: 'SG',
    initialsColor: 'bg-green-100 text-green-700',
    plan: 'Growth',
    planColor: 'bg-blue-50 text-blue-700',
    status: 'Active',
    statusVariant: 'success' as const,
    usage: 64,
    revenue: '₩149,000',
    created: '2026-01-20',
  },
]

interface Tenant {
  id: string
  name: string
  subdomain: string
  initials?: string
  initialsColor?: string
  plan: string
  planColor?: string
  status: string
  statusVariant?: 'success' | 'warning' | 'error'
  usage: number
  revenue: string
  created: string
}

interface TenantsResponse {
  tenants: Tenant[]
  total: number
  page: number
  pageSize: number
}

export function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, loading, error } = useApi<TenantsResponse>('/api/admin/tenants')

  const tenants = data?.tenants || mockTenants
  const total = data?.total || 24

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Tenants">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Tenant
          </button>
        </Header>
        <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading tenants...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Tenants">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Tenant
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Unable to load live data. Showing mock data. Error: {error}
              </p>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  statusFilter === 'all'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All <span className="text-gray-500 ml-1">{total}</span>
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  statusFilter === 'active'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active <span className="text-gray-400 ml-1">20</span>
              </button>
              <button
                onClick={() => setStatusFilter('suspended')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  statusFilter === 'suspended'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Suspended <span className="text-gray-400 ml-1">2</span>
              </button>
              <button
                onClick={() => setStatusFilter('trial')}
                className={`px-3 py-1.5 text-sm font-medium rounded ${
                  statusFilter === 'trial'
                    ? 'bg-gray-100 text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Trial <span className="text-gray-400 ml-1">2</span>
              </button>
            </div>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
              <ArrowUpDown className="w-4 h-4" />
              Sort
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 ${tenant.initialsColor || 'bg-gray-100 text-gray-700'} rounded-lg flex items-center justify-center`}
                        >
                          <span className="text-sm font-semibold">
                            {tenant.initials || tenant.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{tenant.subdomain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tenant.planColor || 'bg-gray-100 text-gray-700'}`}
                      >
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge
                        status={tenant.status}
                        variant={tenant.statusVariant || 'success'}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {tenant.status === 'Suspended' ? (
                        <span className="text-sm text-gray-400">-</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tenant.usage >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${tenant.usage}%` }}
                            ></div>
                          </div>
                          <span
                            className={`text-xs ${
                              tenant.usage >= 80
                                ? 'text-amber-600 font-medium'
                                : 'text-gray-500'
                            }`}
                          >
                            {tenant.usage}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">
                      {tenant.revenue}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{tenant.created}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-3 bg-white border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium">1-{tenants.length}</span> of{' '}
                <span className="font-medium">{total}</span> tenants
              </p>
              <div className="flex items-center gap-1">
                <button
                  className="px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded-md cursor-not-allowed"
                  disabled
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md">
                  1
                </button>
                <button className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                  2
                </button>
                <button className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                  3
                </button>
                <button className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
