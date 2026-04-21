import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { query, where, getDocs } from 'firebase/firestore'
import { MapPin, Plus, LogOut, ArrowUpRight } from 'lucide-react'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { CompanyLogo } from '@/core/ui/company-logo'
import { companyCollection } from '@/core/firebase/helpers'
import { formatCurrency } from '@/core/utils/format'
import { cn } from '@/lib/utils'
import type { Company } from '@/core/types'
import type { Closing } from '@/modules/closings/types'

function ymd(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchDaySales(companyId: string, dateStr: string): Promise<number> {
  const ref = companyCollection(companyId, 'closings')
  const snap = await getDocs(query(ref, where('date', '==', dateStr)))
  return snap.docs.reduce((sum, d) => {
    const data = d.data() as Closing
    return sum + (typeof data.ventaTotal === 'number' ? data.ventaTotal : 0)
  }, 0)
}

const FIVE_MIN = 5 * 60 * 1000

export function CompanySelectorPage() {
  const { companies, loading, selectCompany, addCompany } = useCompany()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (companies.length === 1) {
      selectCompany(companies[0])
      navigate('/home', { replace: true })
    }
  }, [loading, companies, selectCompany, navigate])

  const today = ymd(0)
  const yesterday = ymd(-1)

  const salesQueries = useQueries({
    queries: companies.flatMap((c) => [
      {
        queryKey: ['selector-sales', c.id, today],
        queryFn: () => fetchDaySales(c.id, today),
        staleTime: FIVE_MIN,
      },
      {
        queryKey: ['selector-sales', c.id, yesterday],
        queryFn: () => fetchDaySales(c.id, yesterday),
        staleTime: FIVE_MIN,
      },
    ]),
  })

  const firstName =
    user?.displayName?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    ''

  function handleSelect(company: Company) {
    selectCompany(company)
    navigate('/home')
  }

  async function handleCreate() {
    await addCompany()
    navigate('/settings/companies')
  }

  return (
    <div className="min-h-screen bg-surface text-graphite">
      <p className="fixed top-20 left-12 z-10 text-body text-graphite m-0">
        Bienvenido, <strong className="font-medium text-dark-graphite">{firstName}</strong>.
      </p>

      <div className="fixed top-[72px] right-8 z-10 flex items-center gap-1">
        <button
          type="button"
          onClick={handleCreate}
          className="w-9 h-9 rounded-lg grid place-items-center text-mid-gray hover:bg-smoke hover:text-dark-graphite transition-colors"
          title="Crear compañía"
          aria-label="Crear compañía"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="w-9 h-9 rounded-lg grid place-items-center text-mid-gray hover:bg-smoke hover:text-dark-graphite transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      <div className="max-w-[1320px] mx-auto px-12 pt-40 pb-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {companies.map((c, i) => {
            const todayQ = salesQueries[i * 2]
            const yQ = salesQueries[i * 2 + 1]
            const todayVal = (todayQ?.data as number | undefined) ?? 0
            const yVal = (yQ?.data as number | undefined) ?? 0
            const isLoadingKpi = Boolean(todayQ?.isLoading || yQ?.isLoading)
            const delta = yVal > 0 ? ((todayVal - yVal) / yVal) * 100 : null
            const up = (delta ?? 0) >= 0

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="group relative overflow-hidden flex items-center gap-7 min-h-[168px] p-7 rounded-2xl bg-card-bg border text-left transition-all duration-200 hover:-translate-y-[3px]"
                style={{
                  borderColor: 'rgba(45,45,45,0.06)',
                  boxShadow:
                    '0 1px 2px rgba(45,45,45,.04), 0 4px 12px rgba(45,45,45,.05), 0 12px 32px -8px rgba(45,45,45,.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(45,45,45,0.12)'
                  e.currentTarget.style.boxShadow =
                    '0 2px 4px rgba(45,45,45,.05), 0 8px 20px rgba(45,45,45,.08), 0 24px 48px -12px rgba(45,45,45,.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(45,45,45,0.06)'
                  e.currentTarget.style.boxShadow =
                    '0 1px 2px rgba(45,45,45,.04), 0 4px 12px rgba(45,45,45,.05), 0 12px 32px -8px rgba(45,45,45,.06)'
                }}
              >
                <div className="relative w-20 h-20 shrink-0">
                  <CompanyLogo
                    company={c}
                    size="xl"
                    imgStyle={
                      c.name.toLowerCase().includes('filipo')
                        ? { transform: 'translateX(3px) scale(1.08)' }
                        : undefined
                    }
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      boxShadow:
                        'inset 0 2px 4px rgba(0,0,0,0.155), inset 0 1px 1px rgba(0,0,0,0.055), inset 0 -1px 1px rgba(255,255,255,0.325)',
                    }}
                  />
                </div>
                <div className="flex-1 flex items-center justify-between gap-5 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-subheading font-medium text-dark-graphite tracking-[-0.01em] truncate mb-1.5">
                      {c.name}
                    </h3>
                    {c.location && (
                      <p className="text-body text-mid-gray m-0 inline-flex items-center gap-1.5">
                        <MapPin className="w-[15px] h-[15px] shrink-0" strokeWidth={1.5} />
                        {c.location}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-caption text-mid-gray uppercase tracking-[0.06em]">
                      Ventas hoy
                    </span>
                    <span className="text-kpi font-semibold text-dark-graphite tabular-nums tracking-[-0.02em] leading-tight">
                      {isLoadingKpi ? '…' : formatCurrency(todayVal)}
                    </span>
                    {delta !== null && !isLoadingKpi && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full',
                          up
                            ? 'bg-positive-bg text-positive-text'
                            : 'bg-negative-bg text-negative-text',
                        )}
                      >
                        {up ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs ayer
                      </span>
                    )}
                  </div>
                </div>
                <ArrowUpRight
                  className="absolute top-5 right-5 w-4 h-4 text-mid-gray opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200"
                  strokeWidth={1.5}
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
