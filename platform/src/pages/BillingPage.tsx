import { TrendingUp, CreditCard, BarChart3, Check, Download, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { useApi } from '@/hooks/useApi'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  description: string
  features: string[]
  tenantCount: number
  popular?: boolean
}

interface Payment {
  id: string
  tenant: string
  plan: string
  amount: string
  status: string
  statusVariant: 'success' | 'error'
  date: string
}

interface BillingData {
  stats: {
    monthlyRevenue: number
    activeSubscriptions: number
    totalApiCost: number
  }
  plans: Plan[]
  recentPayments: Payment[]
}

const mockPlans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49000,
    currency: '₩',
    description: 'For small businesses',
    features: [
      '100K tokens/day',
      'Haiku + Flash models',
      '1 messenger integration',
      'Email support',
    ],
    tenantCount: 8,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149000,
    currency: '₩',
    description: 'For growing teams',
    features: [
      '500K tokens/day',
      'All models (Sonnet default)',
      '3 messenger integrations',
      'Priority support + Slack',
      'SOUL.md AI generation',
    ],
    tenantCount: 10,
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 490000,
    currency: '₩',
    description: 'For enterprises',
    features: [
      'Unlimited tokens',
      'All models (Opus available)',
      'Unlimited integrations',
      'Dedicated support',
      'Custom SOUL.md + SLA',
    ],
    tenantCount: 2,
  },
]

const mockPayments: Payment[] = [
  {
    id: '1',
    tenant: 'TechOffice',
    plan: 'Enterprise',
    amount: '₩490,000',
    status: 'Paid',
    statusVariant: 'success',
    date: '2026-02-01',
  },
  {
    id: '2',
    tenant: 'Cafe Bloom',
    plan: 'Growth',
    amount: '₩149,000',
    status: 'Paid',
    statusVariant: 'success',
    date: '2026-02-01',
  },
  {
    id: '3',
    tenant: 'FoodGarden',
    plan: 'Starter',
    amount: '₩49,000',
    status: 'Failed',
    statusVariant: 'error',
    date: '2026-02-01',
  },
  {
    id: '4',
    tenant: 'ShopMall A',
    plan: 'Growth',
    amount: '₩149,000',
    status: 'Paid',
    statusVariant: 'success',
    date: '2026-01-31',
  },
]

export function BillingPage() {
  const { data, loading, error } = useApi<BillingData>('/api/billing/plans')

  const plans = data?.plans || mockPlans
  const payments = data?.recentPayments || mockPayments

  if (loading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Billing" />
        <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading billing data...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Billing" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Unable to load live data. Showing mock data. Error: {error}
              </p>
            </div>
          )}

          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Monthly Revenue"
              value={
                data?.stats?.monthlyRevenue
                  ? `₩${data.stats.monthlyRevenue.toLocaleString()}`
                  : '₩3,240,000'
              }
              icon={TrendingUp}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+8%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="Active Subscriptions"
              value={data?.stats?.activeSubscriptions?.toString() || '20'}
              icon={CreditCard}
              iconBgColor="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              title="Total API Cost"
              value={data?.stats?.totalApiCost ? `$${data.stats.totalApiCost}` : '$248.50'}
              icon={BarChart3}
              iconBgColor="bg-purple-50"
              iconColor="text-purple-600"
            />
          </div>

          {/* Pricing Plans */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white rounded-lg shadow-sm p-6 ${
                    plan.popular
                      ? 'border-2 border-blue-500 relative'
                      : 'border border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                        Popular
                      </span>
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {plan.currency}
                        {plan.price.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="text-center">
                    <span
                      className={`text-sm ${
                        plan.popular ? 'text-blue-600 font-medium' : 'text-gray-500'
                      }`}
                    >
                      {plan.tenantCount} tenants on this plan
                    </span>
                  </div>
                </div>
              ))}
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
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{payment.tenant}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{payment.plan}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-800">{payment.amount}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={payment.status} variant={payment.statusVariant} />
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{payment.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
