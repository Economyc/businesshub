import { ShieldX, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from './page-transition'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'

interface Props {
  /** Página que el guard intentó proteger. Útil para diagnóstico. */
  requestedPageId?: string
}

/**
 * Página de "Acceso restringido". Cuando el viewer es admin (o estamos en dev),
 * se añade un bloque diagnóstico con la empresa activa, rol detectado y página
 * solicitada — más un botón para refrescar permisos. Esto evita debug ciego
 * cuando un rol no concede la página que el usuario espera.
 */
export function NoAccessPage({ requestedPageId }: Props) {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { member, role, isAdmin, refetch, refetchRoles } = usePermissions()
  const [refreshing, setRefreshing] = useState(false)

  const showDiagnostics = isAdmin || import.meta.env.DEV

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await Promise.all([refetch(), refetchRoles()])
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldX size={28} className="text-negative-text" />
        </div>
        <h1 className="text-heading font-semibold text-dark-graphite mb-2">
          Acceso restringido
        </h1>
        <p className="text-body text-mid-gray mb-6 max-w-md">
          No tienes permisos para acceder a este modulo. Contacta al administrador de tu empresa para solicitar acceso.
        </p>

        {showDiagnostics && (
          <div className="mb-6 w-full max-w-md text-left border border-border/60 rounded-xl bg-bone/50 p-4 space-y-1.5">
            <div className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-2">
              Diagnóstico
            </div>
            <DiagRow label="Empresa" value={selectedCompany?.name ?? '—'} />
            <DiagRow label="Página solicitada" value={requestedPageId ?? '—'} mono />
            <DiagRow label="Member" value={member ? `${member.email} (${member.status})` : 'sin membership'} />
            <DiagRow label="Rol" value={role ? `${role.label} (${role.id})` : member ? `id=${member.role} no encontrado` : '—'} mono />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            Ir al inicio
          </button>
          {showDiagnostics && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw size={14} strokeWidth={1.5} className={refreshing ? 'animate-spin' : ''} />
              Refrescar permisos
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  )
}

function DiagRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-caption">
      <span className="text-mid-gray shrink-0">{label}</span>
      <span className={`text-graphite truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
