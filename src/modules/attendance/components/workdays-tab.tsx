import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, CalendarCheck, ChevronDown, Clock, Loader2, Timer, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { DateRangeProvider, useDateRange } from '@/core/ui/date-range-context'
import { EmptyState } from '@/core/ui/empty-state'
import { ExportButton } from '@/core/ui/export-button'
import { KPICard } from '@/core/ui/kpi-card'
import { SearchInput } from '@/core/ui/search-input'
import { SelectInput } from '@/core/ui/select-input'
import { Skeleton } from '@/core/ui/skeleton'
import { cn } from '@/lib/utils'
import type { FieldDef } from '@/core/utils/data-transfer'
import { useFaceProfiles, usePunchesByRange, useScheduledShifts } from '../hooks'
import { attendanceService, formatTimeBogota, toBogotaDate } from '../services'
import { buildWorkdays, formatDuration, punctualityOf, WORKDAY_STATUS_LABEL, type Punctuality, type Workday } from '../shifts'
import type { AttendancePunch } from '../types'

const ALL = 'all'

const EXPORT_FIELDS: FieldDef[] = [
  { key: 'date', header: 'Fecha', type: 'string' },
  { key: 'employee', header: 'Empleado', type: 'string' },
  { key: 'in', header: 'Entrada', type: 'string' },
  { key: 'out', header: 'Salida', type: 'string' },
  { key: 'hours', header: 'Horas', type: 'number', blankNull: true },
  { key: 'scheduled', header: 'Turno programado', type: 'string' },
  { key: 'punctuality', header: 'Puntualidad', type: 'string' },
  { key: 'minutesLate', header: 'Minutos tarde', type: 'number', blankNull: true },
  { key: 'status', header: 'Estado', type: 'string' },
]

type Row = Workday & { punctuality: Punctuality | null }

function punctualityLabel(p: Punctuality | null): string {
  if (!p) return ''
  if (p.kind === 'no-shift') return 'Sin horario'
  return p.kind === 'on-time' ? 'Puntual' : `Tarde ${p.minutesLate} min`
}

/** Historial de marcaciones agrupadas en jornadas (entrada -> salida). */
export function WorkdaysTab() {
  return (
    <DateRangeProvider defaultPreset="today">
      <Workdays />
    </DateRangeProvider>
  )
}

function Workdays() {
  const { startDate, endDate } = useDateRange()
  const from = toBogotaDate(startDate)
  const to = toBogotaDate(endDate)
  const { data: punches, loading } = usePunchesByRange(from, to)
  const shifts = useScheduledShifts(from, to)
  const { data: profiles } = useFaceProfiles()
  const thumbs = useMemo(() => new Map(profiles.map((p) => [p.id, p.thumb])), [profiles])
  const [employeeId, setEmployeeId] = useState(ALL)
  const [search, setSearch] = useState('')

  const workdays = useMemo<Row[]>(
    () => buildWorkdays(punches, Date.now()).map((w) => ({ ...w, punctuality: punctualityOf(w, shifts) })),
    [punches, shifts],
  )

  const employeeOptions = useMemo(() => {
    const names = new Map(punches.map((p) => [p.employeeId, p.employeeName]))
    return [
      { value: ALL, label: 'Todos los empleados' },
      ...[...names].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([value, label]) => ({ value, label })),
    ]
  }, [punches])

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return workdays.filter(
      (w) => (employeeId === ALL || w.employeeId === employeeId) && (!q || normalize(w.employeeName).includes(q)),
    )
  }, [workdays, employeeId, search])

  const summary = useMemo(() => ({
    total: filtered.length,
    hours: Math.round(filtered.reduce((acc, w) => acc + (w.minutes ?? 0), 0) / 60),
    incomplete: filtered.filter((w) => w.status === 'missing-out' || w.status === 'missing-in').length,
    late: filtered.filter((w) => w.punctuality?.kind === 'late').length,
  }), [filtered])

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const w of filtered) map.set(w.date, [...(map.get(w.date) ?? []), w])
    return [...map]
  }, [filtered])

  const exportRows = useMemo(() => filtered.map((w) => ({
    date: w.date,
    employee: w.employeeName,
    in: w.inPunch ? formatTimeBogota(w.inPunch.at.toDate()) : '',
    out: w.outPunch ? formatTimeBogota(w.outPunch.at.toDate()) : '',
    hours: w.minutes != null ? Math.round((w.minutes / 60) * 100) / 100 : null,
    scheduled: w.punctuality && w.punctuality.kind !== 'no-shift' ? w.punctuality.scheduledStart : '',
    punctuality: punctualityLabel(w.punctuality),
    minutesLate: w.punctuality?.kind === 'late' ? w.punctuality.minutesLate : null,
    status: WORKDAY_STATUS_LABEL[w.status],
  })), [filtered])

  return (
    <div className="space-y-6">
      {/* El selector de fechas va a la derecha, como en Cierres y Descuentos: su
          menu se abre hacia la izquierda y pegado al sidebar quedaba tapado. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="lg:w-64">
          <SelectInput value={employeeId} onChange={setEmployeeId} options={employeeOptions} />
        </div>
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre..." />
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
          <ExportButton data={exportRows} fields={EXPORT_FIELDS} filenameBase={`marcaciones_${from}_${to}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Jornadas" value={summary.total} icon={CalendarCheck} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Horas trabajadas" value={summary.hours} icon={Clock} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Llegadas tarde" value={summary.late} icon={Timer} tone={summary.late > 0 ? 'negative' : undefined} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Sin salida o sin entrada" value={summary.incomplete} icon={AlertCircle} tone={summary.incomplete > 0 ? 'negative' : undefined} />
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : groups.length === 0 ? (
        <EmptyState icon={Clock} title="No hay marcaciones en este periodo" description="Cambia el rango de fechas o el filtro de empleado." />
      ) : (
        <div className="space-y-6">
          {groups.map(([date, days]) => (
            <section key={date} className="space-y-2">
              <h3 className="text-caption font-semibold uppercase tracking-wider text-mid-gray">{dayLabel(date)}</h3>
              <div className="card-elevated rounded-xl bg-card-bg divide-y divide-border/60">
                <ColumnHeaders />
                {days.map((w) => <WorkdayRow key={w.id} workday={w} thumb={thumbs.get(w.employeeId)} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// Anchos de columna compartidos por el encabezado y las filas, para que queden
// alineados. La foto (w-10) y el chevron (16px) llevan su hueco en el encabezado.
const COL = { time: 'w-28', punctuality: 'w-32', hours: 'w-24' }

function ColumnHeaders() {
  return (
    <div className="flex items-center gap-4 rounded-t-xl bg-bone px-4 py-2 text-caption font-semibold uppercase tracking-wider text-graphite">
      <span className="w-10 shrink-0" />
      <span className="flex-1">Empleado</span>
      <div className="hidden gap-6 sm:flex">
        <span className={COL.time}>Entrada</span>
        <span className={COL.time}>Salida</span>
      </div>
      <span className={cn(COL.punctuality, 'text-right')}>Puntualidad</span>
      <span className={cn(COL.hours, 'text-right')}>Horas</span>
      <span className="w-4 shrink-0" />
    </div>
  )
}

function WorkdayRow({ workday: w, thumb }: { workday: Row; thumb?: string }) {
  const [open, setOpen] = useState(false)
  const badge =
    w.status === 'open' ? 'info' : w.status === 'missing-out' || w.status === 'missing-in' ? 'warning' : null

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-bone"
      >
        {/* Foto de registro del empleado; la de cada marcacion sale al abrir la fila. */}
        {thumb ? (
          <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <PunchPhoto punch={w.inPunch ?? w.outPunch} size="sm" />
        )}
        <p className="min-w-0 flex-1 truncate text-body font-medium text-dark-graphite">{w.employeeName}</p>
        <div className="hidden gap-6 text-body tabular-nums text-graphite sm:flex">
          <TimeCell punch={w.inPunch} />
          <TimeCell punch={w.outPunch} />
        </div>
        <div className={cn(COL.punctuality, 'text-right')}>
          <PunctualityBadge value={w.punctuality} />
        </div>
        <div className={cn(COL.hours, 'text-right')}>
          {badge ? (
            <Badge variant={badge}>{WORKDAY_STATUS_LABEL[w.status]}</Badge>
          ) : (
            <span className="text-body font-medium tabular-nums text-dark-graphite">{formatDuration(w.minutes ?? 0)}</span>
          )}
        </div>
        <ChevronDown size={16} strokeWidth={1.5} className={cn('shrink-0 text-mid-gray transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-4 px-4 pb-4 sm:max-w-md">
          {w.punctuality && w.punctuality.kind !== 'no-shift' && (
            <p className="col-span-2 text-caption text-mid-gray">
              Turno programado desde las {formatHHmm(w.punctuality.scheduledStart)}
            </p>
          )}
          <PunchDetail label="Entrada" punch={w.inPunch} />
          <PunchDetail label="Salida" punch={w.outPunch} />
        </div>
      )}
    </div>
  )
}

function PunctualityBadge({ value }: { value: Punctuality | null }) {
  if (!value) return null
  if (value.kind === 'no-shift') return <Badge variant="outline">Sin horario</Badge>
  return value.kind === 'on-time'
    ? <Badge variant="positive">Puntual</Badge>
    : <Badge variant="negative">Tarde {value.minutesLate} min</Badge>
}

/** '14:05' -> '2:05 p. m.' (mismo formato que el resto de horas). */
function formatHHmm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)))
}

function TimeCell({ punch }: { punch?: AttendancePunch }) {
  return (
    // Sin quiebre: "8:00 a. m." lleva espacios y el "m." caia al renglon de abajo.
    <span className={cn(COL.time, 'whitespace-nowrap')}>
      {punch ? formatTimeBogota(punch.at.toDate()) : '—'}
    </span>
  )
}

function PunchDetail({ label, punch }: { label: string; punch?: AttendancePunch }) {
  return (
    <div className="space-y-2">
      <p className="whitespace-nowrap text-caption text-mid-gray">
        {label} {punch ? `· ${formatTimeBogota(punch.at.toDate())}` : '· sin marcar'}
      </p>
      <PunchPhoto punch={punch} size="lg" />
    </div>
  )
}

/** Foto de la marcacion. Se borran a los 45 dias: entonces queda el icono. */
function PunchPhoto({ punch, size }: { punch?: AttendancePunch; size: 'sm' | 'lg' }) {
  const { data: url, isError } = useQuery({
    queryKey: ['attendancePhoto', punch?.photoPath],
    queryFn: () => attendanceService.photoUrl(punch!.photoPath),
    enabled: !!punch?.photoPath,
    staleTime: Infinity,
    retry: false,
  })
  const box = size === 'sm' ? 'h-10 w-10 rounded-full' : 'aspect-[3/4] w-full rounded-xl'

  if (url) {
    const img = <img src={url} alt="" className={cn(box, 'shrink-0 object-cover')} />
    return size === 'lg' ? <a href={url} target="_blank" rel="noreferrer">{img}</a> : img
  }
  return (
    <div className={cn(box, 'flex shrink-0 items-center justify-center bg-bone text-mid-gray')}>
      {!punch || isError ? <UserRound size={16} strokeWidth={1.5} /> : <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
    </div>
  )
}

function dayLabel(date: string): string {
  const label = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
