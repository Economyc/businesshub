import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, LogOut, ArrowUpRight } from 'lucide-react'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { CompanyLogo } from '@/core/ui/company-logo'
import { Skeleton } from '@/core/ui/skeleton'
import { HoverHint } from '@/components/ui/tooltip'
import type { Company } from '@/core/types'

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

  const hasCompanies = companies.length > 0

  return (
    <div className="relative min-h-screen bg-surface text-graphite">
      <p className="absolute top-4 left-4 md:top-20 md:left-12 z-10 text-caption md:text-body text-graphite m-0">
        Bienvenido, <strong className="font-medium text-dark-graphite">{firstName}</strong>.
      </p>

      <div className="absolute top-3 right-3 md:top-[72px] md:right-8 z-10 flex items-center gap-1">
        <HoverHint label="Crear compañía">
          <button
            type="button"
            onClick={handleCreate}
            className="w-9 h-9 rounded-lg grid place-items-center text-mid-gray hover:bg-smoke hover:text-dark-graphite transition-colors"
            aria-label="Crear compañía"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
        </HoverHint>
        <HoverHint label="Cerrar sesión">
          <button
            type="button"
            onClick={() => logout()}
            className="w-9 h-9 rounded-lg grid place-items-center text-mid-gray hover:bg-smoke hover:text-dark-graphite transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
        </HoverHint>
      </div>

      <div className="max-w-[1320px] mx-auto px-4 pt-20 pb-12 md:px-12 md:pt-40 md:pb-28">
        {!hasCompanies ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="flex items-center gap-5 md:gap-7 min-h-[140px] md:min-h-[168px] p-5 md:p-7 rounded-2xl bg-card-bg border border-border/60"
              >
                <Skeleton className="w-20 h-20 rounded-full shrink-0" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-5 w-44 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {companies.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="group relative overflow-hidden flex items-center gap-5 md:gap-7 min-h-[140px] md:min-h-[168px] p-5 md:p-7 rounded-2xl bg-card-bg border text-left transition-all duration-200 hover:-translate-y-[3px]"
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
                <div className="min-w-0">
                  <h3 className="text-subheading font-medium text-dark-graphite tracking-[-0.01em] truncate mb-1 md:mb-1.5">
                    {c.name}
                  </h3>
                  {c.location && (
                    <p className="text-body text-mid-gray m-0 inline-flex items-center gap-1.5">
                      <MapPin className="w-[15px] h-[15px] shrink-0" strokeWidth={1.5} />
                      {c.location}
                    </p>
                  )}
                </div>
                <ArrowUpRight
                  className="absolute top-4 right-4 md:top-5 md:right-5 w-4 h-4 text-mid-gray opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200"
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
