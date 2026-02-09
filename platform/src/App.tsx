import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { TenantsPage } from './pages/TenantsPage'
import { TenantDetailPage } from './pages/TenantDetailPage'
import { BillingPage } from './pages/BillingPage'
import { HealthPage } from './pages/HealthPage'
import { SettingsPage } from './pages/SettingsPage'
import { SoulPage } from './pages/SoulPage'
import { LoginPage } from './pages/LoginPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage'
import { AdminIncidentsPage } from './pages/admin/AdminIncidentsPage'
import { AdminSegmentsPage } from './pages/admin/AdminSegmentsPage'
import { AdminBillingPage } from './pages/admin/AdminBillingPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="soul" element={<SoulPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/tenants" element={<AdminTenantsPage />} />
          <Route path="admin/incidents" element={<AdminIncidentsPage />} />
          <Route path="admin/segments" element={<AdminSegmentsPage />} />
          <Route path="admin/billing" element={<AdminBillingPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
