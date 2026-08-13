import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/core/query/query-client'
import { AuthProvider, useAuth } from '@/core/hooks/use-auth'
import { CompanyProvider } from '@/core/ui/company-provider'
import { PermissionsProvider } from '@/core/ui/permissions-provider'
import { PermissionRoute } from '@/core/ui/permission-route'
import { LoginPage } from '@/core/ui/login-page'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/core/ui/error-boundary'
import { Skeleton } from '@/core/ui/skeleton'
import { DateRangeProvider } from '@/core/ui/date-range-context'
import { AdminLayout } from './layout'
import { DefaultRedirect } from './default-redirect'
// Módulos: Horarios es nuevo; Cierres y Descuentos se reutilizan tal cual de App1
// (mismo monorepo, mismo Firebase). No se copia código.
import { ScheduleView } from '@/modules/schedule/routes'
import { EmployeeList, EmployeeProfile } from '@/modules/talent/routes'
import { ClosingList } from '@/modules/closings/routes'
import { DiscountsPage } from '@/modules/discounts/routes'
import { InventoryPage } from '@/modules/inventory/routes'

// Departamentos que manejan horarios: la grilla de Horarios en App2 sólo
// muestra empleados de estos, y en este orden (Administración va junto a
// Servicio, no alfabético). Referencia estable para no invalidar memos.
const SCHEDULE_DEPARTMENTS = ['Cocina', 'Servicio', 'Administración']

function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-48 rounded" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

// Zona protegida: requiere sesión, monta permisos y el layout de App2.
function Protected() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <PermissionsProvider>
      <ErrorBoundary>
        <AdminLayout />
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
                <Route element={<Protected />}>
                  <Route index element={<DefaultRedirect />} />

                  <Route element={<PermissionRoute pageId="schedule" />}>
                    <Route path="/horarios" element={<Suspense fallback={<Loading />}><ScheduleView allowedDepartments={SCHEDULE_DEPARTMENTS} /></Suspense>} />
                  </Route>

                  {/* Equipo (Talent): mismas rutas que App1 (/talent, /talent/:id) porque
                      EmployeeList/EmployeeProfile navegan a /talent de forma fija. */}
                  <Route element={<PermissionRoute pageId="talent" />}>
                    <Route path="/talent" element={<Suspense fallback={<Loading />}><EmployeeList /></Suspense>} />
                    <Route path="/talent/:id" element={<Suspense fallback={<Loading />}><EmployeeProfile /></Suspense>} />
                  </Route>

                  <Route element={<PermissionRoute pageId="inventory" />}>
                    <Route path="/inventario" element={<Suspense fallback={<Loading />}><InventoryPage /></Suspense>} />
                  </Route>

                  {/* Cierres y Descuentos requieren DateRangeProvider (igual que en App1). */}
                  <Route element={<DateRangeProvider><Outlet /></DateRangeProvider>}>
                    <Route element={<PermissionRoute pageId="closings" />}>
                      <Route path="/cierres" element={<Suspense fallback={<Loading />}><ClosingList accumulatedOwnerOnly /></Suspense>} />
                    </Route>
                    <Route element={<PermissionRoute pageId="discounts" />}>
                      <Route path="/descuentos" element={<Suspense fallback={<Loading />}><DiscountsPage /></Suspense>} />
                    </Route>
                  </Route>

                  {/* Rutas inexistentes (logueado) → redirect inteligente.
                      Sin sesión, Protected redirige antes a /login. */}
                  <Route path="*" element={<DefaultRedirect />} />
                </Route>
              </Routes>
            </TooltipProvider>
          </CompanyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  )
}
