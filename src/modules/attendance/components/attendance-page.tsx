import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, RefreshCw, ScanFace, Clock, Tablet, UserRound } from 'lucide-react'
import { HoverHint } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/core/ui/page-header'
import { EmptyState } from '@/core/ui/empty-state'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { Skeleton } from '@/core/ui/skeleton'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { useCompany } from '@/core/hooks/use-company'
import { useActiveEmployees } from '@/modules/talent/hooks'
import { useFaceProfiles, useKioskLink, useRemoveFaceProfile } from '../hooks'
import { attendanceService } from '../services'
import { EnrollDialog } from './enroll-dialog'
import { WorkdaysTab } from './workdays-tab'

interface AttendancePageProps {
  /** Departamentos que marcan (mismos que la grilla de Horarios). */
  allowedDepartments?: string[]
}

type Tab = 'workdays' | 'employees'

export function AttendancePage({ allowedDepartments }: AttendancePageProps) {
  const [tab, setTab] = useState<Tab>('workdays')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marcación"
        subtitle={<span className="text-body text-mid-gray">Entrada y salida con reconocimiento facial</span>}
      />
      <KioskLinkCard />
      <div>
        <UnderlineButtonTabs
          tabs={[
            { value: 'workdays', label: 'Marcaciones', icon: Clock },
            { value: 'employees', label: 'Empleados', icon: UserRound },
          ]}
          active={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        {tab === 'workdays' ? <WorkdaysTab /> : <EmployeesTab allowedDepartments={allowedDepartments} />}
      </div>
    </div>
  )
}

// ── Link del local ────────────────────────────────────────────────────────
function KioskLinkCard() {
  const { selectedCompany } = useCompany()
  const { token, loading, error, refetch } = useKioskLink()
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const url = token ? `${window.location.origin}/marcar/${token}` : ''

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function rotate() {
    if (!selectedCompany) return
    await attendanceService.kioskLink(selectedCompany.id, true)
    await refetch()
    setConfirmRotate(false)
  }

  const iconButton = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mid-gray transition-colors hover:bg-bone hover:text-graphite'

  // Barra compacta de una linea: el link se usa una vez por local (abrirlo en la
  // tablet), asi que no merece una card grande encima del historial.
  return (
    <div className="card-elevated flex flex-col gap-4 rounded-xl bg-card-bg p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bone text-graphite">
          <Tablet size={18} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-body font-medium text-dark-graphite">Link de la tablet</p>
          <p className="truncate text-caption text-mid-gray">Solo sirve para marcar; no da acceso a nada más</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:justify-end">
        {loading ? (
          <Skeleton className="h-9 flex-1 rounded-lg sm:max-w-md" />
        ) : error ? (
          <p className="text-body text-negative-text">No se pudo obtener el link. Recarga la página.</p>
        ) : (
          <>
            <button
              type="button"
              onClick={copy}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/60 bg-bone px-4 text-left transition-colors hover:border-border-hover sm:max-w-md"
            >
              <span className="min-w-0 flex-1 truncate text-caption text-graphite">{url}</span>
              {copied ? (
                <span className="flex shrink-0 items-center gap-1 text-caption text-positive-text"><Check size={14} strokeWidth={1.5} /> Copiado</span>
              ) : (
                <Copy size={14} strokeWidth={1.5} className="shrink-0 text-mid-gray" />
              )}
            </button>
            <HoverHint label="Abrir en otra pestaña">
              <a href={url} target="_blank" rel="noreferrer" className={iconButton} aria-label="Abrir link">
                <ExternalLink size={16} strokeWidth={1.5} />
              </a>
            </HoverHint>
            <HoverHint label="Generar un link nuevo">
              <button type="button" onClick={() => setConfirmRotate(true)} className={iconButton} aria-label="Generar un link nuevo">
                <RefreshCw size={16} strokeWidth={1.5} />
              </button>
            </HoverHint>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmRotate}
        title="¿Seguro que quieres cambiar el link?"
        description="El link actual deja de funcionar de inmediato y la tablet del local no podrá marcar hasta que abras el nuevo en ella. Hazlo solo si el link se compartió fuera del local."
        confirmLabel="Sí, cambiar el link"
        loadingLabel="Generando..."
        variant="neutral"
        onConfirm={rotate}
        onCancel={() => setConfirmRotate(false)}
      />
    </div>
  )
}

// ── Empleados: registro facial ────────────────────────────────────────────
function EmployeesTab({ allowedDepartments }: { allowedDepartments?: string[] }) {
  const { data: employees, loading: loadingEmployees } = useActiveEmployees()
  const { data: profiles, loading: loadingProfiles } = useFaceProfiles()
  const removeProfile = useRemoveFaceProfile()
  const [enrolling, setEnrolling] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const rows = useMemo(
    () =>
      employees
        .filter((e) => !allowedDepartments || (e.department && allowedDepartments.includes(e.department)))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [employees, allowedDepartments],
  )
  const enrolledCount = rows.filter((e) => profileById.has(e.id)).length

  if (loadingEmployees || loadingProfiles) return <Skeleton className="h-64 rounded-xl" />
  if (rows.length === 0) {
    return <EmptyState icon={UserRound} title="Sin empleados activos" description="Agrega empleados en Equipo para poder registrarlos." />
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-mid-gray">
        {enrolledCount} de {rows.length} empleados registrados. Los que no estén registrados no pueden marcar.
      </p>
      <div className="card-elevated rounded-xl bg-card-bg divide-y divide-border/60">
        {rows.map((e) => {
          const profile = profileById.get(e.id)
          return (
            <div key={e.id} className="flex items-center gap-4 p-4">
              {profile?.thumb ? (
                <img src={profile.thumb} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bone text-mid-gray">
                  <UserRound size={18} strokeWidth={1.5} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-medium text-dark-graphite">{e.name}</p>
                <p className="text-caption text-mid-gray">{e.department ?? 'Sin departamento'}</p>
              </div>
              {profile ? <Badge variant="positive">Registrado</Badge> : <Badge variant="warning">Sin registrar</Badge>}
              <div className="flex gap-2">
                <Button variant={profile ? 'outline' : 'default'} size="sm" onClick={() => setEnrolling({ id: e.id, name: e.name })}>
                  <ScanFace size={14} strokeWidth={1.5} />
                  {profile ? 'Actualizar foto' : 'Registrar'}
                </Button>
                {profile && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving({ id: e.id, name: e.name })}>
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <EnrollDialog employee={enrolling} profiles={profiles} onClose={() => setEnrolling(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={`Quitar el registro de ${removing?.name ?? ''}`}
        description="No podrá marcar hasta que se registre de nuevo. Sus marcaciones anteriores se conservan."
        confirmLabel="Quitar registro"
        loadingLabel="Quitando..."
        onConfirm={async () => {
          if (removing) await removeProfile.mutateAsync(removing.id)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
