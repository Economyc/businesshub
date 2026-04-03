import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/core/query/query-client'
import { Skeleton } from '@/core/ui/skeleton'
import { AuthProvider, useAuth } from '@/core/hooks/use-auth'
import { CompanyProvider } from '@/core/ui/company-provider'
import { Layout } from '@/core/ui/layout'
import { LoginPage } from '@/core/ui/login-page'
import { GeneralDashboard, CostsDashboard, PurchasesDashboard, PayrollDashboard } from '@/modules/analytics/routes'
import { EmployeeList, EmployeeProfile } from '@/modules/talent/routes'
import { SupplierList, SupplierDetail } from '@/modules/suppliers/routes'
import { TransactionList, ImportView, CashFlowView, IncomeStatementView, BudgetView, RecurringList } from '@/modules/finance/routes'
import { SettingsCompanies } from '@/core/ui/settings-companies'
import { SettingsCategories } from '@/core/ui/settings-categories'
import { SettingsRoles } from '@/core/ui/settings-roles'
import { SettingsDepartments } from '@/core/ui/settings-departments'
import { PartnerList } from '@/modules/partners/routes'
import { ClosingList } from '@/modules/closings/routes'
import { ContractList, TemplateList, ContractGenerate, ContractDetail } from '@/modules/contracts/routes'
import { PurchaseList, PurchaseForm, PurchaseDetail, ProductList, ProductDetail } from '@/modules/purchases/routes'
import { HomePage } from '@/modules/home/routes'
import { CarteraDashboard } from '@/modules/cartera/routes'
import { PayrollList, PayrollDetail } from '@/modules/payroll/routes'
import { DateRangeProvider } from '@/modules/finance/context/date-range-context'

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
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route path="/home" element={<Suspense fallback={<Loading />}><HomePage /></Suspense>} />
              </Route>
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route path="/analytics" element={<Suspense fallback={<Loading />}><GeneralDashboard /></Suspense>} />
                <Route path="/analytics/costs" element={<Suspense fallback={<Loading />}><CostsDashboard /></Suspense>} />
                <Route path="/analytics/purchases" element={<Suspense fallback={<Loading />}><PurchasesDashboard /></Suspense>} />
                <Route path="/analytics/payroll" element={<Suspense fallback={<Loading />}><PayrollDashboard /></Suspense>} />
              </Route>
              <Route path="/talent" element={<Suspense fallback={<Loading />}><EmployeeList /></Suspense>} />
              <Route path="/talent/:id" element={<Suspense fallback={<Loading />}><EmployeeProfile /></Suspense>} />
              <Route path="/payroll" element={<Suspense fallback={<Loading />}><PayrollList /></Suspense>} />
              <Route path="/payroll/:id" element={<Suspense fallback={<Loading />}><PayrollDetail /></Suspense>} />
              <Route path="/suppliers" element={<Suspense fallback={<Loading />}><SupplierList /></Suspense>} />
              <Route path="/suppliers/:id" element={<Suspense fallback={<Loading />}><SupplierDetail /></Suspense>} />
              <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                <Route path="/finance" element={<Suspense fallback={<Loading />}><TransactionList /></Suspense>} />
                <Route path="/finance/new" element={<Navigate to="/finance" replace />} />
                <Route path="/finance/edit/:id" element={<Navigate to="/finance" replace />} />
                <Route path="/finance/recurring" element={<Suspense fallback={<Loading />}><RecurringList /></Suspense>} />
                <Route path="/finance/import" element={<Suspense fallback={<Loading />}><ImportView /></Suspense>} />
                <Route path="/finance/cash-flow" element={<Suspense fallback={<Loading />}><CashFlowView /></Suspense>} />
                <Route path="/finance/income-statement" element={<Suspense fallback={<Loading />}><IncomeStatementView /></Suspense>} />
                <Route path="/finance/budget" element={<Suspense fallback={<Loading />}><BudgetView /></Suspense>} />
                <Route path="/finance/purchases" element={<Suspense fallback={<Loading />}><PurchaseList /></Suspense>} />
                <Route path="/finance/purchases/new" element={<Suspense fallback={<Loading />}><PurchaseForm /></Suspense>} />
                <Route path="/finance/purchases/products" element={<Suspense fallback={<Loading />}><ProductList /></Suspense>} />
                <Route path="/finance/purchases/products/:id" element={<Suspense fallback={<Loading />}><ProductDetail /></Suspense>} />
                <Route path="/finance/purchases/:id" element={<Suspense fallback={<Loading />}><PurchaseDetail /></Suspense>} />
              </Route>
              <Route path="/cartera" element={<Suspense fallback={<Loading />}><CarteraDashboard /></Suspense>} />
              <Route path="/partners" element={<Suspense fallback={<Loading />}><PartnerList /></Suspense>} />
              <Route path="/closings" element={<Suspense fallback={<Loading />}><ClosingList /></Suspense>} />
              <Route path="/contracts" element={<Suspense fallback={<Loading />}><ContractList /></Suspense>} />
              <Route path="/contracts/templates" element={<Suspense fallback={<Loading />}><TemplateList /></Suspense>} />
              <Route path="/contracts/new" element={<Suspense fallback={<Loading />}><ContractGenerate /></Suspense>} />
              <Route path="/contracts/:id" element={<Suspense fallback={<Loading />}><ContractDetail /></Suspense>} />
              <Route path="/settings" element={<Navigate to="/settings/companies" replace />} />
              <Route path="/settings/companies" element={<Suspense fallback={<Loading />}><SettingsCompanies /></Suspense>} />
              <Route path="/settings/categories" element={<Suspense fallback={<Loading />}><SettingsCategories /></Suspense>} />
              <Route path="/settings/roles" element={<Suspense fallback={<Loading />}><SettingsRoles /></Suspense>} />
              <Route path="/settings/departments" element={<Suspense fallback={<Loading />}><SettingsDepartments /></Suspense>} />
            </Route>
          </Routes>
        </CompanyProvider>
      </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
