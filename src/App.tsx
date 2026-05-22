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
import { EmployeeList, EmployeeProfile } from '@/modules/talent/routes'
import { SupplierList, SupplierDetail } from '@/modules/suppliers/routes'
import { TransactionList, ImportView, CashFlowView, IncomeStatementView, BudgetView, PayrollView, BankImportView } from '@/modules/finance/routes'
import { PartnerList } from '@/modules/partners/routes'
import { ClosingList } from '@/modules/closings/routes'
import { DiscountsPage } from '@/modules/discounts/routes'
import { ContractList, TemplateList, ContractGenerate, ContractDetail } from '@/modules/contracts/routes'
import { HomePage } from '@/modules/home/routes'
import { CompanySelectorPage } from '@/modules/home/company-selector-page'
import { DateRangeProvider } from '@/modules/finance/context/date-range-context'
import { AgentPage } from '@/modules/agent/routes'
import { TasksPage } from '@/modules/tasks/routes'
import { PosSyncPage } from '@/modules/pos-sync/routes'
import { InfluencerList } from '@/modules/marketing/influencers/routes'
import { PermissionsProvider } from '@/core/ui/permissions-provider'
import { PermissionRoute } from '@/core/ui/permission-route'
import { ErrorBoundary } from '@/core/ui/error-boundary'
import { TooltipProvider } from '@/components/ui/tooltip'

// Settings: lazy para sacarlos del bundle inicial (solo los usan admins).
const SettingsCompanies = lazy(() => import('@/core/ui/settings-companies').then(m => ({ default: m.SettingsCompanies })))
const SettingsCategories = lazy(() => import('@/core/ui/settings-categories').then(m => ({ default: m.SettingsCategories })))
const SettingsRoles = lazy(() => import('@/core/ui/settings-roles').then(m => ({ default: m.SettingsRoles })))
const SettingsPuestos = lazy(() => import('@/core/ui/settings-puestos').then(m => ({ default: m.SettingsPuestos })))
const SettingsDepartments = lazy(() => import('@/core/ui/settings-departments').then(m => ({ default: m.SettingsDepartments })))
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
              <Route element={<PermissionRoute pageId="talent" />}>
                <Route path="/talent" element={<Suspense fallback={<Loading />}><EmployeeList /></Suspense>} />
                <Route path="/talent/:id" element={<Suspense fallback={<Loading />}><EmployeeProfile /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="suppliers" />}>
                <Route path="/suppliers" element={<Suspense fallback={<Loading />}><SupplierList /></Suspense>} />
                <Route path="/suppliers/:id" element={<Suspense fallback={<Loading />}><SupplierDetail /></Suspense>} />
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route path="/finance/new" element={<Navigate to="/finance" replace />} />
                <Route path="/finance/edit/:id" element={<Navigate to="/finance" replace />} />
                <Route path="/finance/recurring" element={<Navigate to="/finance" replace />} />
                <Route element={<PermissionRoute pageId="finance.invoicing" />}>
                  <Route path="/finance" element={<Suspense fallback={<Loading />}><TransactionList /></Suspense>} />
                  <Route path="/finance/import" element={<Suspense fallback={<Loading />}><ImportView /></Suspense>} />
                </Route>
                <Route element={<PermissionRoute pageId="finance.payroll" />}>
                  <Route path="/finance/nomina" element={<Suspense fallback={<Loading />}><PayrollView /></Suspense>} />
                </Route>
                <Route element={<PermissionRoute pageId="finance.bank" />}>
                  <Route path="/finance/bank" element={<Suspense fallback={<Loading />}><BankImportView /></Suspense>} />
                </Route>
                <Route element={<PermissionRoute pageId="finance.cashflow" />}>
                  <Route path="/finance/cash-flow" element={<Suspense fallback={<Loading />}><CashFlowView /></Suspense>} />
                </Route>
                <Route element={<PermissionRoute pageId="finance.income" />}>
                  <Route path="/finance/income-statement" element={<Suspense fallback={<Loading />}><IncomeStatementView /></Suspense>} />
                </Route>
                <Route element={<PermissionRoute pageId="finance.budget" />}>
                  <Route path="/finance/budget" element={<Suspense fallback={<Loading />}><BudgetView /></Suspense>} />
                </Route>
              </Route>
              <Route element={<PermissionRoute pageId="partners" />}>
                <Route path="/partners" element={<Suspense fallback={<Loading />}><PartnerList /></Suspense>} />
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="closings" />}>
                  <Route path="/closings" element={<Suspense fallback={<Loading />}><ClosingList /></Suspense>} />
                </Route>
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="discounts" />}>
                  <Route path="/discounts" element={<Suspense fallback={<Loading />}><DiscountsPage /></Suspense>} />
                </Route>
              </Route>
              <Route element={<PermissionRoute pageId="contracts" />}>
                <Route path="/contracts" element={<Suspense fallback={<Loading />}><ContractList /></Suspense>} />
                <Route path="/contracts/templates" element={<Suspense fallback={<Loading />}><TemplateList /></Suspense>} />
                <Route path="/contracts/new" element={<Suspense fallback={<Loading />}><ContractGenerate /></Suspense>} />
                <Route path="/contracts/:id" element={<Suspense fallback={<Loading />}><ContractDetail /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="agent" />}>
                <Route path="/agent" element={<Suspense fallback={<Loading />}><AgentPage /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="tasks" />}>
                <Route path="/tasks" element={<Suspense fallback={<Loading />}><TasksPage /></Suspense>} />
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="marketing" />}>
                  <Route path="/marketing/influencers" element={<Suspense fallback={<Loading />}><InfluencerList /></Suspense>} />
                </Route>
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route element={<PermissionRoute pageId="pos-sync" />}>
                  <Route path="/pos-sync" element={<Suspense fallback={<Loading />}><PosSyncPage /></Suspense>} />
                </Route>
              </Route>
              <Route path="/settings" element={<Navigate to="/settings/companies" replace />} />
              <Route path="/settings/cargos" element={<Navigate to="/settings/puestos" replace />} />
              <Route element={<PermissionRoute pageId="settings.companies" />}>
                <Route path="/settings/companies" element={<Suspense fallback={<Loading />}><SettingsCompanies /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.categories" />}>
                <Route path="/settings/categories" element={<Suspense fallback={<Loading />}><SettingsCategories /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.roles" />}>
                <Route path="/settings/roles" element={<Suspense fallback={<Loading />}><SettingsRoles /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.puestos" />}>
                <Route path="/settings/puestos" element={<Suspense fallback={<Loading />}><SettingsPuestos /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.departments" />}>
                <Route path="/settings/departments" element={<Suspense fallback={<Loading />}><SettingsDepartments /></Suspense>} />
              </Route>
              <Route element={<PermissionRoute pageId="settings.team" />}>
                <Route path="/settings/team" element={<Suspense fallback={<Loading />}><SettingsTeam /></Suspense>} />
              </Route>
            </Route>
          </Routes>
          </TooltipProvider>
        </CompanyProvider>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
