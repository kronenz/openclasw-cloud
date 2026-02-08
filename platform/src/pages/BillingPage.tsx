import { TrendingUp, CreditCard, BarChart3, Check, Download } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'

export function BillingPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Billing" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Monthly Revenue"
              value="₩3,240,000"
              icon={TrendingUp}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+8%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="Active Subscriptions"
              value="20"
              icon={CreditCard}
              iconBgColor="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total API Cost"
              value="$248.50"
              icon={BarChart3}
              iconBgColor="bg-purple-50"
              iconColor="text-purple-600"
            />
          </div>

          {/* Pricing Plans */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Starter */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Starter</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">₩49,000</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">For small businesses</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    100K tokens/day
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Haiku + Flash models
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    1 messenger integration
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Email support
                  </li>
                </ul>
                <div className="text-center">
                  <span className="text-sm text-gray-500">8 tenants on this plan</span>
                </div>
              </div>

              {/* Growth (Popular) */}
              <div className="bg-white rounded-lg border-2 border-blue-500 shadow-sm p-6 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Popular
                  </span>
                </div>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Growth</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">₩149,000</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">For growing teams</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    500K tokens/day
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    All models (Sonnet default)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    3 messenger integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Priority support + Slack
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    SOUL.md AI generation
                  </li>
                </ul>
                <div className="text-center">
                  <span className="text-sm text-blue-600 font-medium">10 tenants on this plan</span>
                </div>
              </div>

              {/* Enterprise */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">₩490,000</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">For enterprises</p>
                </div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Unlimited tokens
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    All models (Opus available)
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Unlimited integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Dedicated support
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    Custom SOUL.md + SLA
                  </li>
                </ul>
                <div className="text-center">
                  <span className="text-sm text-gray-500">2 tenants on this plan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Payments</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">TechOffice</td>
                  <td className="px-6 py-3 text-sm text-gray-600">Enterprise</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">₩490,000</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Paid" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">2026-02-01</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">Cafe Bloom</td>
                  <td className="px-6 py-3 text-sm text-gray-600">Growth</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">₩149,000</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Paid" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">2026-02-01</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">FoodGarden</td>
                  <td className="px-6 py-3 text-sm text-gray-600">Starter</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">₩49,000</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Failed" variant="error" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">2026-02-01</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">ShopMall A</td>
                  <td className="px-6 py-3 text-sm text-gray-600">Growth</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">₩149,000</td>
                  <td className="px-6 py-3">
                    <StatusBadge status="Paid" variant="success" />
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">2026-01-31</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
