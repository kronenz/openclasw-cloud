import { Building2, CreditCard, AlertTriangle, Activity, BarChart3, Plus, Settings, FileText, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatCard } from '@/components/StatCard'

const platformEvents = [
  {
    icon: Plus,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    text: 'New tenant provisioned',
    highlight: 'FashionShop Korea',
    time: '5 minutes ago',
  },
  {
    icon: CreditCard,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    text: '',
    highlight: 'TechOffice',
    suffix: 'upgraded to Enterprise',
    time: '12 minutes ago',
  },
  {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    text: 'Critical incident',
    highlight: 'INC-027',
    suffix: 'created for BookStore',
    time: '28 minutes ago',
  },
  {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    text: 'Auto-recovery resolved',
    highlight: 'INC-026',
    suffix: '',
    time: '1 hour ago',
  },
  {
    icon: FileText,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    text: 'Monthly reports generated for',
    highlight: '24 tenants',
    suffix: '',
    time: '3 hours ago',
  },
  {
    icon: TrendingUp,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    text: 'Revenue milestone',
    highlight: '₩5M MRR',
    suffix: 'reached',
    time: '6 hours ago',
  },
]

export function AdminDashboardPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Admin Dashboard" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Tenants"
              value="24"
              icon={Building2}
              iconBgColor="bg-blue-50"
              iconColor="text-blue-600"
              trend={{ value: '+12%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="Monthly Revenue"
              value="₩5,240,000"
              icon={CreditCard}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+18%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="Active Incidents"
              value="3"
              icon={AlertTriangle}
              iconBgColor="bg-red-50"
              iconColor="text-red-600"
            />
            <StatCard
              title="Platform Uptime"
              value="99.9%"
              icon={Activity}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+0.1%', direction: 'up', label: 'vs last week' }}
            />
          </div>

          {/* Charts + Events Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Platform Metrics Chart */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-gray-900">Platform Metrics</h3>
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
                  <p className="text-sm">Recharts line chart</p>
                  <p className="text-xs mt-1">Requests, Latency, Error Rate</p>
                </div>
              </div>
            </div>

            {/* Recent Platform Events */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Events</h3>
              <div className="space-y-4">
                {platformEvents.map((event, index) => (
                  <div key={index} className="flex gap-3">
                    <div
                      className={`w-8 h-8 ${event.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
                    >
                      <event.icon className={`w-4 h-4 ${event.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">
                        {event.text}{event.text && ' '}
                        <span className="font-medium">{event.highlight}</span>
                        {event.suffix && ' '}
                        {event.suffix}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{event.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue Trend + Quick Actions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Chart */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue Trend (6 Months)</h3>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                <div className="text-center text-gray-400">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Recharts bar chart</p>
                  <p className="text-xs mt-1">Monthly revenue progression</p>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Provision Tenant</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">View Incidents</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Generate Report</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mb-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">System Settings</span>
                </button>
              </div>

              {/* System Status Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">System Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">API Workers</span>
                    </div>
                    <span className="font-medium text-gray-900">Healthy</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">D1 Database</span>
                    </div>
                    <span className="font-medium text-gray-900">Healthy</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      <span className="text-gray-600">AI Gateway</span>
                    </div>
                    <span className="font-medium text-yellow-700">Degraded</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">R2 Storage</span>
                    </div>
                    <span className="font-medium text-gray-900">Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
