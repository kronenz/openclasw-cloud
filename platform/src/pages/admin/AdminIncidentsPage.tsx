import { Plus, Clock, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'

const incidents = [
  {
    id: 'INC-027',
    title: 'AI Gateway timeout - Multiple tenants affected',
    severity: 'P0',
    severityColor: 'bg-red-50 text-red-700',
    status: 'Investigating',
    statusVariant: 'warning' as const,
    tenant: 'BookStore',
    created: '28 minutes ago',
    updated: '5 minutes ago',
    recoveryAttempts: 5,
    assignedAgent: 'operations-agent-03',
  },
  {
    id: 'INC-026',
    title: 'High latency on D1 database queries',
    severity: 'P1',
    severityColor: 'bg-orange-50 text-orange-700',
    status: 'Resolved',
    statusVariant: 'success' as const,
    tenant: 'Cafe Bloom',
    created: '1 hour ago',
    updated: '15 minutes ago',
    recoveryAttempts: 2,
    assignedAgent: 'operations-agent-01',
  },
  {
    id: 'INC-025',
    title: 'Rate limit exceeded - Token quota exhausted',
    severity: 'P2',
    severityColor: 'bg-yellow-50 text-yellow-700',
    status: 'Resolved',
    statusVariant: 'success' as const,
    tenant: 'ShopMall A',
    created: '3 hours ago',
    updated: '2 hours ago',
    recoveryAttempts: 1,
    assignedAgent: 'operations-agent-02',
  },
  {
    id: 'INC-024',
    title: 'Integration webhook failure - Kakao Talk',
    severity: 'P1',
    severityColor: 'bg-orange-50 text-orange-700',
    status: 'Open',
    statusVariant: 'error' as const,
    tenant: 'FashionShop Korea',
    created: '4 hours ago',
    updated: '30 minutes ago',
    recoveryAttempts: 3,
    assignedAgent: 'integration-agent-05',
  },
  {
    id: 'INC-023',
    title: 'Memory leak in SOUL.md processor',
    severity: 'P3',
    severityColor: 'bg-gray-50 text-gray-700',
    status: 'Investigating',
    statusVariant: 'warning' as const,
    tenant: 'Platform',
    created: '6 hours ago',
    updated: '1 hour ago',
    recoveryAttempts: 0,
    assignedAgent: 'platform-agent-01',
  },
]

export function AdminIncidentsPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Incident Management">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">
          <Plus className="w-4 h-4" />
          Create Incident
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Incidents</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">27</p>
                </div>
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Open</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">3</p>
                </div>
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Investigating</p>
                  <p className="text-2xl font-bold text-yellow-600 mt-1">2</p>
                </div>
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Avg Resolution Time</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">42m</p>
                </div>
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex border-b border-gray-200">
              <button className="px-6 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                All (5)
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent">
                Open (1)
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent">
                Investigating (2)
              </button>
              <button className="px-6 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent">
                Resolved (2)
              </button>
            </div>
          </div>

          {/* Incident Cards */}
          <div className="space-y-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${incident.severityColor}`}
                      >
                        {incident.severity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900">{incident.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 font-mono">#{incident.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={incident.status} variant={incident.statusVariant} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Affected Tenant</p>
                    <p className="font-medium text-gray-900">{incident.tenant}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Created</p>
                    <p className="font-medium text-gray-900">{incident.created}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Last Updated</p>
                    <p className="font-medium text-gray-900">{incident.updated}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Recovery Attempts</p>
                    <p className="font-medium text-gray-900">{incident.recoveryAttempts}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Assigned Agent</p>
                    <p className="font-medium text-gray-900 font-mono text-xs">{incident.assignedAgent}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
                  <button className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                    View Details
                  </button>
                  <button className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                    Add Comment
                  </button>
                  {incident.status === 'Investigating' && (
                    <button className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100">
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
