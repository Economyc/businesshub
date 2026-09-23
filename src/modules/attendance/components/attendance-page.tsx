import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, RefreshCw, ScanFace, Clock, UserRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/core/ui/page-header'
import { EmptyState } from '@/core/ui/empty-state'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { Skeleton } from '@/core/ui/skeleton'
import { UnderlineButtonTabs } from '@/core/ui/underline-tabs'
import { useCompany } from '@/core/hooks/use-company'
import { useActiveEmployees } from '@/modules/talent/hooks'
import { useFaceProfiles, useKioskLink, usePunchesByDate, useRemoveFaceProfile } from '../hooks'
import { attendanceService, formatTimeBogota, todayBogota } from '../services'
import { PUNCH_TYPE_LABEL, type AttendancePunch } from '../types'
import { EnrollDialog } from './enroll-dialog'

interface AttendancePageProps {
  /** Departamentos que marcan (mismos que la grilla de Horarios). */
  allowedDepartments?: string[]
}

type Tab = 'employees' | 'today'

export function AttendancePage({ allowedDepartments }: AttendancePageProps) {
  const [tab, setTab] = useState<Tab>('employees')

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
            { value: 'employees', label: 'Empleados', icon: UserRound },
            { value: 'today', label: 'Marcaciones de hoy', icon: Clock },
          ]}
          active={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        {tab === 'employees' ? <EmployeesTab allowedDepartments={allowedDepartments} /> : <TodayTab />}
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

  return (
    <div className="card-elevated rounded-xl bg-card-bg p-6 space-y-4">
      <div>
        <h2 className="text-subheading font-medium text-dark-graphite">Link de marcación de {selectedCompany?.name}</h2>
        <p className="text-body text-mid-gray mt-1">
          Ábrelo en la tablet o el PC fijo del local y déjalo abierto. Solo sirve para tomarse la foto; no da acceso a nada más.
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-9 rounded-lg" />
      ) : error ? (
        <p className="text-body text-negative-text">No se pudo obtener el link. Recarga la página.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-border/60 bg-bone px-4 py-2 text-body text-graphite">
            {url}
          </code>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
              <ExternalLink size={16} strokeWidth={1.5} /> Abrir
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRotate(true)}>
              <RefreshCw size={16} strokeWidth={1.5} /> Generar nuevo
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmRotate}
        title="Generar un link nuevo"
        description="El link actual deja de funcionar de inmediato. Úsalo si el link se compartió fuera del local; después hay que abrir el nuevo en la tablet."
        confirmLabel="Generar link nuevo"
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

// ── Marcaciones de hoy ────────────────────────────────────────────────────
function TodayTab() {
  const { data: punches, loading } = usePunchesByDate(todayBogota())

  if (loading) return <Skeleton className="h-64 rounded-xl" />
  if (punches.length === 0) {
    return <EmptyState icon={Clock} title="Nadie ha marcado hoy" description="Las marcaciones del link del local aparecen aquí en cuanto se registran." />
  }

  return (
    <div className="card-elevated rounded-xl bg-card-bg divide-y divide-border/60">
      {punches.map((p) => <PunchRow key={p.id} punch={p} />)}
    </div>
  )
}

function PunchRow({ punch }: { punch: AttendancePunch }) {
  const { data: photo, isError } = useQuery({
    queryKey: ['attendancePhoto', punch.photoPath],
    queryFn: () => attendanceService.photoUrl(punch.photoPath),
    staleTime: Infinity,
    retry: false,
  })

  return (
    <div className="flex items-center gap-4 p-4">
      {photo ? (
        <a href={photo} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />
        </a>
      ) : (
        // Sin foto: aun cargando, o ya borrada (se guardan 45 dias).
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bone text-mid-gray">
          {isError ? <UserRound size={16} strokeWidth={1.5} /> : <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
        </div>
      )}
      <p className="min-w-0 flex-1 truncate text-body font-medium text-dark-graphite">{punch.employeeName}</p>
      <Badge variant={punch.type === 'in' ? 'positive' : 'info'}>{PUNCH_TYPE_LABEL[punch.type]}</Badge>
      <span className="w-20 text-right text-body tabular-nums text-graphite">{formatTimeBogota(punch.at.toDate())}</span>
    </div>
  )
}
