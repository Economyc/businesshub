import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/core/query/query-client'
import { Skeleton } from '@/core/ui/skeleton'
import { AuthProvider, useAuth } from '@/core/hooks/use-auth'
import { CompanyProvider } from '@/core/ui/company-provider'
import { Layout } from '@/core/ui/layout'
import { LoginPage } from '@/core/ui/login-page'
import { PosDashboard } from '@/modules/analytics/routes'
import { HomePage } from '@/modules/home/routes'
import { CompanySelectorPage } from '@/modules/home/company-selector-page'
import { DateRangeProvider } from '@/core/ui/date-range-context'
import { PosSyncPage } from '@/modules/pos-sync/routes'
import { PermissionsProvider } from '@/core/ui/permissions-provider'
import { PermissionRoute } from '@/core/ui/permission-route'
import { ErrorBoundary } from '@/core/ui/error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'

// Settings: lazy para sacarlos del bundle inicial (solo los usan admins).
const SettingsCompanies = lazy(() => import('@/core/ui/settings-companies').then(m => ({ default: m.SettingsCompanies })))
const SettingsCategories = lazy(() => import('@/core/ui/settings-categories').then(m => ({ default: m.SettingsCategories })))
const SettingsRoles = lazy(() => import('@/core/ui/settings-roles').then(m => ({ default: m.SettingsRoles })))
const SettingsDepartments = lazy(() => import('@/core/ui/settings-departments').then(m => ({ default: m.SettingsDepartments })))
const SettingsPaymentMethods = lazy(() => import('@/core/ui/settings-payment-methods').then(m => ({ default: m.SettingsPaymentMethods })))
const SettingsTeam = lazy(() => import('@/core/ui/settings-team').then(m => ({ default: m.SettingsTeam })))

function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

function ProtectedRoute() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <PermissionsProvider>
      <ErrorBoundary>
        <Layout />
      </ErrorBoundary>
    </PermissionsProvider>
  )
}

function ProtectedShellless() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <PermissionsProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </PermissionsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <TooltipProvider delayDuration={250} skipDelayDuration={300}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedShellless />}>
              <Route path="/" element={<CompanySelectorPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="home" />}>
                  <Route path="/home" element={<Suspense fallback={<Loading />}><HomePage /></Suspense>} />
                </Route>
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="analytics" />}>
                  <Route path="/analytics" element={<Suspense fallback={<Loading />}><PosDashboard /></Suspense>} />
                </Route>
                <Route path="/analytics/pos" element={<Navigate to="/analytics" replace />} />
                <Route path="/analytics/costs" element={<Navigate to="/analytics" replace />} />
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="pos-sync" />}>
                  <Route path="/pos-sync" element={<Suspense fallback={<Loading />}><PosSyncPage /></Suspense>} />
                </Route>
              </Route>
              <Route path="/settings" element={<Navigate to="/settings/companies" replace />} />
              <Route element={<PermissionRoute pageId="settings.companies" />}>
                <Route path="/settings/companies" element={<Suspense fallback={<Loading />}><SettingsCompanies /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.categories" />}>
                <Route path="/settings/categories" element={<Suspense fallback={<Loading />}><SettingsCategories /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.roles" />}>
                <Route path="/settings/roles" element={<Suspense fallback={<Loading />}><SettingsRoles /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.departments" />}>
                <Route path="/settings/departments" element={<Suspense fallback={<Loading />}><SettingsDepartments /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.payment-methods" />}>
                <Route path="/settings/payment-methods" element={<Suspense fallback={<Loading />}><SettingsPaymentMethods /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.team" />}>
                <Route path="/settings/team" element={<Suspense fallback={<Loading />}><SettingsTeam /></Suspense>} />
              </Route>
              {/* Las rutas de los módulos retirados (/finance, /talent, /closings…)
                  siguen en marcadores y en el historial de los usuarios. Sin este
                  catch-all React Router no renderiza nada y queda la pantalla en
                  blanco, que se lee como que la app se rompió. */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
          </Routes>
          </TooltipProvider>
        </CompanyProvider>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
