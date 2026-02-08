import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HeartPulse,
  Settings,
  Bot,
  Users,
  LogOut,
  Shield,
  AlertTriangle,
  PieChart,
  Wallet
} from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">OpenClaw</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/tenants"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Building2 className="w-5 h-5" />
          <span>Tenants</span>
        </NavLink>

        <NavLink
          to="/billing"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <CreditCard className="w-5 h-5" />
          <span>Billing</span>
        </NavLink>

        <div className="pt-4 pb-2">
          <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Operations
          </p>
        </div>

        <NavLink
          to="/health"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <HeartPulse className="w-5 h-5" />
          <span>Health</span>
        </NavLink>

        <div className="pt-4 pb-2">
          <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
            System
          </p>
        </div>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </NavLink>

        <div className="pt-4 pb-2">
          <p className="px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Admin
          </p>
        </div>

        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Shield className="w-5 h-5" />
          <span>Overview</span>
        </NavLink>

        <NavLink
          to="/admin/tenants"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Users className="w-5 h-5" />
          <span>All Tenants</span>
        </NavLink>

        <NavLink
          to="/admin/incidents"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <AlertTriangle className="w-5 h-5" />
          <span>Incidents</span>
        </NavLink>

        <NavLink
          to="/admin/segments"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <PieChart className="w-5 h-5" />
          <span>Segments</span>
        </NavLink>

        <NavLink
          to="/admin/billing"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`
          }
        >
          <Wallet className="w-5 h-5" />
          <span>Revenue</span>
        </NavLink>
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <Users className="w-4 h-4 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">Operator</p>
            <p className="text-xs text-gray-500 truncate">admin@openclaw.ai</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
