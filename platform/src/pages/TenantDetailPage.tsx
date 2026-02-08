import { useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Pencil,
  HeartPulse,
  BarChart3,
  CreditCard,
  MessageSquare,
  Globe,
  Database,
  HardDrive,
  Folder,
  Send,
  Hash,
  Circle,
  Plus,
  Key,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { StatusBadge } from '@/components/StatusBadge'

export function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  const tenant = {
    id: tenantId || 'cafe-bloom',
    name: 'Cafe Bloom',
    subdomain: 'cafe-bloom.openclaw.ai',
    initials: 'CB',
    initialsColor: 'bg-blue-100 text-blue-700',
    status: 'Active',
    statusVariant: 'success' as const,
    plan: 'Growth Plan',
    industry: 'Cafe',
    contact: 'bloom@cafe.kr',
    created: '2026-01-15',
    segment: 'Champion',
    health: 'Healthy',
    tokensToday: '42,180',
    tokensPercent: 42,
    monthCost: '$12.48',
    monthCostKrw: '₩16,200',
    conversations: '1,247',
  }

  const resources = [
    { name: 'Worker', icon: Globe, status: 'Active' },
    { name: 'D1 Database', icon: Database, status: 'Active' },
    { name: 'KV Namespace', icon: HardDrive, status: 'Active' },
    { name: 'R2 Storage', icon: Folder, status: 'Active' },
  ]

  const integrations = [
    { name: 'KakaoTalk', icon: MessageSquare, color: 'text-yellow-600', connected: true },
    { name: 'Telegram', icon: Send, color: 'text-blue-500', connected: true },
    { name: 'Slack', icon: Hash, color: 'text-purple-500', connected: false },
    { name: 'Discord', icon: Circle, color: 'text-indigo-500', connected: false },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <a href="/tenants" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 ${tenant.initialsColor} rounded-lg flex items-center justify-center`}
              >
                <span className="text-sm font-semibold">{tenant.initials}</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{tenant.name}</h1>
                <p className="text-xs text-gray-500 font-mono">{tenant.subdomain}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={tenant.status} variant={tenant.statusVariant} />
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {tenant.plan}
            </span>
            <button className="ml-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-6">
              <a
                href="#"
                className="pb-3 border-b-2 border-blue-600 text-sm font-medium text-blue-600"
              >
                Overview
              </a>
              <a
                href="#"
                className="pb-3 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Resources
              </a>
              <a
                href="#"
                className="pb-3 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Integrations
              </a>
              <a
                href="#"
                className="pb-3 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Settings
              </a>
            </nav>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <HeartPulse className="w-4 h-4" />
                Health
              </div>
              <p className="text-xl font-bold text-green-600">{tenant.health}</p>
              <p className="text-xs text-gray-400 mt-1">Checked 2 min ago</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                Today's Tokens
              </div>
              <p className="text-xl font-bold text-gray-900">{tenant.tokensToday}</p>
              <p className="text-xs text-gray-400 mt-1">{tenant.tokensPercent}% of daily limit</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <CreditCard className="w-4 h-4" />
                Month Cost
              </div>
              <p className="text-xl font-bold text-gray-900">{tenant.monthCost}</p>
              <p className="text-xs text-gray-400 mt-1">{tenant.monthCostKrw} estimated</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <MessageSquare className="w-4 h-4" />
                Conversations
              </div>
              <p className="text-xl font-bold text-gray-900">{tenant.conversations}</p>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </div>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Info Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Tenant Info</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">ID</dt>
                  <dd className="text-sm text-gray-800 font-mono">tn_01HX...</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Industry</dt>
                  <dd className="text-sm text-gray-800">{tenant.industry}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Contact</dt>
                  <dd className="text-sm text-gray-800">{tenant.contact}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-800">{tenant.created}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Segment</dt>
                  <dd>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                      {tenant.segment}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Resources */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Resources</h3>
              <div className="space-y-3">
                {resources.map((resource, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <resource.icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{resource.name}</span>
                    </div>
                    <StatusBadge status={resource.status} variant="success" />
                  </div>
                ))}
              </div>
            </div>

            {/* Integrations */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Integrations</h3>
              <div className="space-y-3">
                {integrations.map((integration, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <integration.icon className={`w-4 h-4 ${integration.color}`} />
                      <span className="text-sm text-gray-700">{integration.name}</span>
                    </div>
                    <StatusBadge
                      status={integration.connected ? 'Connected' : 'Not connected'}
                      variant={integration.connected ? 'success' : 'neutral'}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Usage Chart */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Usage Trend (30 Days)</h3>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Tokens</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Cost</span>
                </div>
              </div>
            </div>
            <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
              <div className="text-center text-gray-400">
                <BarChart3 className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Recharts dual-axis area chart</p>
              </div>
            </div>
          </div>

          {/* API Key Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                    <Plus className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">Tenant provisioned successfully</p>
                    <p className="text-xs text-gray-400">2026-01-15 14:30</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">KakaoTalk integration activated</p>
                    <p className="text-xs text-gray-400">2026-01-15 15:12</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                    <Key className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">API key generated</p>
                    <p className="text-xs text-gray-400">2026-01-15 15:45</p>
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
