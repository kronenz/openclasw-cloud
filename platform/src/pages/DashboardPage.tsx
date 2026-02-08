import { Building2, CreditCard, BarChart3, HeartPulse, Plus, AlertTriangle, CheckCircle, FileText, ArrowRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { DataTable } from '@/components/DataTable'

const recentActivities = [
  {
    icon: Plus,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    text: 'New tenant',
    highlight: 'Cafe Bloom',
    suffix: 'provisioned',
    time: '2 minutes ago',
  },
  {
    icon: CreditCard,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    text: '',
    highlight: 'TechOffice',
    suffix: 'upgraded to Growth plan',
    time: '15 minutes ago',
  },
  {
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-50',
    text: '',
    highlight: 'ShopMall A',
    suffix: 'usage at 85%',
    time: '1 hour ago',
  },
  {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    text: 'Auto-recovery resolved',
    highlight: 'INC-0024',
    suffix: '',
    time: '3 hours ago',
  },
  {
    icon: FileText,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    text: 'Weekly reports sent to',
    highlight: '18 tenants',
    suffix: '',
    time: '6 hours ago',
  },
]

const tenantHealthData = [
  { name: 'Cafe Bloom', status: 'Healthy', requests: '1,247' },
  { name: 'TechOffice', status: 'Healthy', requests: '3,891' },
  { name: 'ShopMall A', status: 'Degraded', requests: '892' },
  { name: 'Beauty Bar', status: 'Healthy', requests: '456' },
]

const tenantSegments = [
  { name: 'Champion', color: 'bg-green-500', count: 9, percentage: 38 },
  { name: 'Potential Upsell', color: 'bg-blue-500', count: 6, percentage: 25 },
  { name: 'New', color: 'bg-purple-500', count: 4, percentage: 17 },
  { name: 'Need Attention', color: 'bg-yellow-500', count: 3, percentage: 12 },
  { name: 'At Risk', color: 'bg-red-500', count: 2, percentage: 8 },
  { name: 'Happy Inactive', color: 'bg-gray-400', count: 0, percentage: 0 },
]

export function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Dashboard" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Active Tenants"
              value="24"
              icon={Building2}
              iconBgColor="bg-blue-50"
              iconColor="text-blue-600"
              trend={{ value: '+12%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="Monthly Revenue"
              value="₩3,240,000"
              icon={CreditCard}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+8%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="API Requests (Today)"
              value="12,847"
              icon={BarChart3}
              iconBgColor="bg-purple-50"
              iconColor="text-purple-600"
              trend={{ value: '-3%', direction: 'down', label: 'vs yesterday' }}
            />
            <StatCard
              title="System Health"
              value="99.8%"
              icon={HeartPulse}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
            />
          </div>

          {/* Charts + Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Usage Chart Placeholder */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-gray-900">Token Usage (7 Days)</h3>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md">
                    7D
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                    30D
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                    90D
                  </button>
                </div>
              </div>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                <div className="text-center text-gray-400">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Recharts area chart</p>
                  <p className="text-xs mt-1">Daily token usage by model</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex gap-3">
                    <div
                      className={`w-8 h-8 ${activity.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
                    >
                      <activity.icon className={`w-4 h-4 ${activity.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">
                        {activity.text}{activity.text && ' '}
                        <span className="font-medium">{activity.highlight}</span>
                        {activity.suffix && ' '}
                        {activity.suffix}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tenant Health + Segments Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenant Health Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Tenant Health</h3>
                <a
                  href="#"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <DataTable
                columns={[
                  { key: 'name', header: 'Tenant' },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (item) => (
                      <StatusBadge
                        status={item.status}
                        variant={item.status === 'Healthy' ? 'success' : 'warning'}
                      />
                    ),
                  },
                  {
                    key: 'requests',
                    header: 'Requests',
                    render: (item) => (
                      <span className="text-sm text-gray-600 font-mono">{item.requests}</span>
                    ),
                  },
                ]}
                data={tenantHealthData}
              />
            </div>

            {/* Segment Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Tenant Segments</h3>
              <div className="space-y-3">
                {tenantSegments.map((segment, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${segment.color}`}></div>
                      <span className="text-sm text-gray-700">{segment.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${segment.color} rounded-full`}
                          style={{ width: `${segment.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-800 w-6 text-right">
                        {segment.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
