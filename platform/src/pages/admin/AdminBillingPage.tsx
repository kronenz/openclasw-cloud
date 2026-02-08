import { TrendingUp, DollarSign, TrendingDown, Users, Download, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/Header'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'

const recentTransactions = [
  {
    id: 'TXN-2026-02-001',
    tenant: 'TechOffice',
    plan: 'Enterprise',
    amount: '₩490,000',
    status: 'Paid',
    date: '2026-02-01',
  },
  {
    id: 'TXN-2026-02-002',
    tenant: 'Dental Clinic Plus',
    plan: 'Enterprise',
    amount: '₩490,000',
    status: 'Paid',
    date: '2026-02-01',
  },
  {
    id: 'TXN-2026-02-003',
    tenant: 'Cafe Bloom',
    plan: 'Growth',
    amount: '₩149,000',
    status: 'Paid',
    date: '2026-02-01',
  },
  {
    id: 'TXN-2026-02-004',
    tenant: 'ShopMall A',
    plan: 'Growth',
    amount: '₩149,000',
    status: 'Paid',
    date: '2026-02-01',
  },
  {
    id: 'TXN-2026-02-005',
    tenant: 'FashionShop Korea',
    plan: 'Growth',
    amount: '₩149,000',
    status: 'Paid',
    date: '2026-02-01',
  },
  {
    id: 'TXN-2026-02-006',
    tenant: 'Beauty Bar',
    plan: 'Starter',
    amount: '₩49,000',
    status: 'Pending',
    date: '2026-02-01',
  },
]

const overduePayments = [
  {
    tenant: 'FoodGarden',
    plan: 'Starter',
    amount: '₩49,000',
    dueDate: '2026-02-01',
    daysOverdue: 7,
  },
  {
    tenant: 'BookStore',
    plan: 'Growth',
    amount: '₩149,000',
    dueDate: '2026-01-28',
    daysOverdue: 11,
  },
]

const planRevenue = [
  { plan: 'Starter', tenants: 8, revenue: '₩392,000', color: 'bg-purple-500' },
  { plan: 'Growth', tenants: 10, revenue: '₩1,490,000', color: 'bg-blue-500' },
  { plan: 'Enterprise', tenants: 2, revenue: '₩980,000', color: 'bg-green-500' },
]

export function AdminBillingPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="Platform Billing">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
          <Download className="w-4 h-4" />
          Export Revenue Report
        </button>
      </Header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total MRR"
              value="₩5,240,000"
              icon={TrendingUp}
              iconBgColor="bg-green-50"
              iconColor="text-green-600"
              trend={{ value: '+18%', direction: 'up', label: 'vs last month' }}
            />
            <StatCard
              title="ARR"
              value="₩62,880,000"
              icon={DollarSign}
              iconBgColor="bg-blue-50"
              iconColor="text-blue-600"
              trend={{ value: '+18%', direction: 'up', label: 'vs last year' }}
            />
            <StatCard
              title="Churn Rate"
              value="2.1%"
              icon={TrendingDown}
              iconBgColor="bg-red-50"
              iconColor="text-red-600"
              trend={{ value: '-0.5%', direction: 'down', label: 'vs last month' }}
            />
            <StatCard
              title="ARPU"
              value="₩218,000"
              icon={Users}
              iconBgColor="bg-purple-50"
              iconColor="text-purple-600"
              trend={{ value: '+5%', direction: 'up', label: 'vs last month' }}
            />
          </div>

          {/* Revenue Chart + Plan Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue Trend (6 Months)</h3>
              <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
                <div className="text-center text-gray-400">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Recharts area chart</p>
                  <p className="text-xs mt-1">MRR over last 6 months</p>
                </div>
              </div>
            </div>

            {/* Plan Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
              <div className="space-y-4">
                {planRevenue.map((plan, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${plan.color}`}></div>
                        <span className="text-sm font-medium text-gray-900">{plan.plan}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{plan.revenue}</p>
                        <p className="text-xs text-gray-500">{plan.tenants} tenants</p>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${plan.color}`}
                        style={{
                          width: `${
                            (parseInt(plan.revenue.replace(/[^0-9]/g, '')) / 2862000) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Monthly Revenue</span>
                  <span className="font-bold text-gray-900">₩2,862,000</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-500">Active Subscriptions</span>
                  <span className="font-medium text-gray-900">20</span>
                </div>
              </div>
            </div>
          </div>

          {/* Overdue Payments Warning */}
          {overduePayments.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-2">
                    Overdue Payments ({overduePayments.length})
                  </h3>
                  <div className="space-y-2">
                    {overduePayments.map((payment, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-md p-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.tenant}</p>
                          <p className="text-xs text-gray-500">
                            {payment.plan} - Due: {payment.dueDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600">{payment.amount}</p>
                          <p className="text-xs text-red-600">{payment.daysOverdue} days overdue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Transaction ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-mono text-gray-600">{transaction.id}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{transaction.tenant}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{transaction.plan}</td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{transaction.amount}</td>
                      <td className="px-6 py-3">
                        <StatusBadge
                          status={transaction.status}
                          variant={transaction.status === 'Paid' ? 'success' : 'warning'}
                        />
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{transaction.date}</td>
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
