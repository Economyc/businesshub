import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { CompanyProvider } from '@/core/ui/company-provider'
import { Layout } from '@/core/ui/layout'
import { KPIDashboard } from '@/modules/insights/routes'
import { EmployeeList, EmployeeForm, EmployeeProfile } from '@/modules/talent/routes'
import { SupplierList, SupplierForm, SupplierDetail } from '@/modules/suppliers/routes'
import { TransactionList } from '@/modules/finance/routes'

function Loading() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="text-mid-gray text-body">Cargando...</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/insights" replace />} />
            <Route path="/insights" element={<Suspense fallback={<Loading />}><KPIDashboard /></Suspense>} />
            <Route path="/talent" element={<Suspense fallback={<Loading />}><EmployeeList /></Suspense>} />
            <Route path="/talent/new" element={<Suspense fallback={<Loading />}><EmployeeForm /></Suspense>} />
            <Route path="/talent/:id" element={<Suspense fallback={<Loading />}><EmployeeProfile /></Suspense>} />
            <Route path="/suppliers" element={<Suspense fallback={<Loading />}><SupplierList /></Suspense>} />
            <Route path="/suppliers/new" element={<Suspense fallback={<Loading />}><SupplierForm /></Suspense>} />
            <Route path="/suppliers/:id" element={<Suspense fallback={<Loading />}><SupplierDetail /></Suspense>} />
            <Route path="/finance" element={<Suspense fallback={<Loading />}><TransactionList /></Suspense>} />
          </Route>
        </Routes>
      </CompanyProvider>
    </BrowserRouter>
  )
}
