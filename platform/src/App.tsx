import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

// Lazy-loaded pages
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const TenantsPage = lazy(() => import('./pages/TenantsPage').then(m => ({ default: m.TenantsPage })))
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage').then(m => ({ default: m.TenantDetailPage })))
const BillingPage = lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })))
const HealthPage = lazy(() => import('./pages/HealthPage').then(m => ({ default: m.HealthPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SoulPage = lazy(() => import('./pages/SoulPage').then(m => ({ default: m.SoulPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const AdminTenantsPage = lazy(() => import('./pages/admin/AdminTenantsPage').then(m => ({ default: m.AdminTenantsPage })))
const AdminIncidentsPage = lazy(() => import('./pages/admin/AdminIncidentsPage').then(m => ({ default: m.AdminIncidentsPage })))
const AdminSegmentsPage = lazy(() => import('./pages/admin/AdminSegmentsPage').then(m => ({ default: m.AdminSegmentsPage })))
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage').then(m => ({ default: m.AdminBillingPage })))

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/landing" element={
          <Suspense fallback={<LoadingFallback />}>
            <LandingPage />
          </Suspense>
        } />
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
          <Route path="tenants" element={
            <Suspense fallback={<LoadingFallback />}>
              <TenantsPage />
            </Suspense>
          } />
          <Route path="tenants/:tenantId" element={
            <Suspense fallback={<LoadingFallback />}>
              <TenantDetailPage />
            </Suspense>
          } />
          <Route path="billing" element={
            <Suspense fallback={<LoadingFallback />}>
              <BillingPage />
            </Suspense>
          } />
          <Route path="health" element={
            <Suspense fallback={<LoadingFallback />}>
              <HealthPage />
            </Suspense>
          } />
          <Route path="soul" element={
            <Suspense fallback={<LoadingFallback />}>
              <SoulPage />
            </Suspense>
          } />
          <Route path="chat" element={
            <Suspense fallback={<LoadingFallback />}>
              <ChatPage />
            </Suspense>
          } />
          <Route path="integrations" element={
            <Suspense fallback={<LoadingFallback />}>
              <IntegrationsPage />
            </Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<LoadingFallback />}>
              <SettingsPage />
            </Suspense>
          } />
          <Route path="admin" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminDashboardPage />
            </Suspense>
          } />
          <Route path="admin/tenants" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminTenantsPage />
            </Suspense>
          } />
          <Route path="admin/incidents" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminIncidentsPage />
            </Suspense>
          } />
          <Route path="admin/segments" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminSegmentsPage />
            </Suspense>
          } />
          <Route path="admin/billing" element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminBillingPage />
            </Suspense>
          } />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
