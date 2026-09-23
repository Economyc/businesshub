import { useMemo, useState } from 'react'
import { CalendarX, ChevronDown, Percent, Timer, TrendingDown, UserRound } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { DateRangePicker } from '@/core/ui/date-range-picker'
import { DateRangeProvider, useDateRange } from '@/core/ui/date-range-context'
import { EmptyState } from '@/core/ui/empty-state'
import { ExportButton } from '@/core/ui/export-button'
import { KPICard } from '@/core/ui/kpi-card'
import { SearchInput } from '@/core/ui/search-input'
import { Skeleton } from '@/core/ui/skeleton'
import { cn } from '@/lib/utils'
import type { FieldDef } from '@/core/utils/data-transfer'
import { toBogotaDate } from '../services'
import { buildPunctualityReport, type EmployeePunctuality, type PunctualityLevel } from '../report'
import { normalizeName, useAttendanceRows } from '../use-attendance-rows'

const LEVEL_TEXT: Record<PunctualityLevel, string> = {
  good: 'text-positive-text',
  warn: 'text-warning-text',
  bad: 'text-negative-text',
}
const LEVEL_BAR: Record<PunctualityLevel, string> = {
  good: 'bg-positive-text',
  warn: 'bg-warning-text',
  bad: 'bg-negative-text',
}

const EXPORT_FIELDS: FieldDef[] = [
  { key: 'rank', header: 'Puesto', type: 'number' },
  { key: 'employeeName', header: 'Empleado', type: 'string' },
  { key: 'rate', header: '% puntualidad', type: 'number', blankNull: true },
  { key: 'measured', header: 'Jornadas medidas', type: 'number' },
  { key: 'onTime', header: 'A tiempo', type: 'number' },
  { key: 'late', header: 'Tarde', type: 'number' },
  { key: 'lateMinutes', header: 'Minutos tarde', type: 'number' },
  { key: 'absences', header: 'Faltas', type: 'number' },
  { key: 'earlyLeaves', header: 'Salidas antes', type: 'number' },
  { key: 'earlyMinutes', header: 'Minutos salida anticipada', type: 'number' },
]

/** Ranking de puntualidad por empleado. */
export function PunctualityTab() {
  return (
    <DateRangeProvider defaultPreset="thisMonth">
      <Report />
    </DateRangeProvider>
  )
}

function Report() {
  const { startDate, endDate } = useDateRange()
  const from = toBogotaDate(startDate)
  const to = toBogotaDate(endDate)
  const { rows, loading, thumbs, hasSchedule } = useAttendanceRows(from, to)
  const [search, setSearch] = useState('')

  const report = useMemo(() => buildPunctualityReport(rows), [rows])
  const filtered = useMemo(() => {
    const q = normalizeName(search.trim())
    return q ? report.filter((e) => normalizeName(e.employeeName).includes(q)) : report
  }, [report, search])

  const totals = useMemo(() => {
    const measured = report.reduce((a, e) => a + e.measured, 0)
    const onTime = report.reduce((a, e) => a + e.onTime, 0)
    return {
      rate: measured > 0 ? Math.round((onTime / measured) * 100) : 0,
      late: report.reduce((a, e) => a + e.late, 0),
      lateMinutes: report.reduce((a, e) => a + e.lateMinutes, 0),
      absences: report.reduce((a, e) => a + e.absences, 0),
    }
  }, [report])

  const exportRows = useMemo(() => report.map((e, i) => ({ ...e, rank: i + 1 })), [report])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre..." />
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker />
          <ExportButton data={exportRows} fields={EXPORT_FIELDS} filenameBase={`puntualidad_${from}_${to}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Puntualidad del local" value={totals.rate} format="percent" icon={Percent} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Llegadas tarde" value={totals.late} icon={Timer} tone={totals.late > 0 ? 'negative' : undefined} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Minutos tarde" value={totals.lateMinutes} icon={TrendingDown} tone={totals.lateMinutes > 0 ? 'negative' : undefined} />
        <KPICard className="bg-bone" labelClassName="font-semibold text-graphite" label="Faltas" value={totals.absences} icon={CalendarX} tone={totals.absences > 0 ? 'negative' : undefined} />
      </div>

      {!loading && !hasSchedule && (
        <Alert variant="warning">
          No hay horario cargado para este periodo.
        </Alert>
      )}

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Percent} title="No hay datos en este periodo" description="Cambia el rango de fechas." />
      ) : (
        <div className="card-elevated overflow-hidden rounded-xl bg-card-bg divide-y divide-border/60">
          <Headers />
          {filtered.map((e, i) => (
            <EmployeeRow key={e.employeeId} rank={report.indexOf(e) + 1} stats={e} thumb={thumbs.get(e.employeeId)} striped={i % 2 === 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// Anchos compartidos entre encabezado y filas.
const COL = { rank: 'w-8', rate: 'w-40', num: 'w-20' }

function Headers() {
  return (
    <div className="flex items-center gap-4 bg-smoke px-4 py-2 text-caption font-semibold uppercase tracking-wider text-graphite">
      <span className={cn(COL.rank, 'text-right')}>#</span>
      <span className="w-10 shrink-0" />
      <span className="flex-1">Empleado</span>
      <span className={COL.rate}>Puntualidad</span>
      <span className={cn(COL.num, 'hidden text-right md:block')}>A tiempo</span>
      <span className={cn(COL.num, 'hidden text-right md:block')}>Tarde</span>
      <span className={cn(COL.num, 'hidden text-right sm:block')}>Min. tarde</span>
      <span className={cn(COL.num, 'hidden text-right sm:block')}>Faltas</span>
      <span className={cn(COL.num, 'hidden text-right lg:block')}>Salió antes</span>
      <span className="w-4 shrink-0" />
    </div>
  )
}

function EmployeeRow({ rank, stats: e, thumb, striped }: { rank: number; stats: EmployeePunctuality; thumb?: string; striped: boolean }) {
  const [open, setOpen] = useState(false)
  const num = 'text-right text-body tabular-nums text-graphite'

  return (
    <div className={cn(striped && 'bg-bone')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-smoke">
        <span className={cn(COL.rank, 'text-right text-body font-semibold tabular-nums text-mid-gray')}>{rank}</span>
        {thumb ? (
          <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bone text-mid-gray">
            <UserRound size={16} strokeWidth={1.5} />
          </div>
        )}
        <p className="min-w-0 flex-1 truncate text-body font-medium text-dark-graphite">{e.employeeName}</p>
        <div className={cn(COL.rate, 'flex items-center gap-2')}>
          {e.rate == null || !e.level ? (
            <span className="text-caption text-mid-gray">Sin horario</span>
          ) : (
            <>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-smoke">
                <div className={cn('h-full rounded-full', LEVEL_BAR[e.level])} style={{ width: `${e.rate}%` }} />
              </div>
              <span className={cn('w-14 text-right text-body font-semibold tabular-nums', LEVEL_TEXT[e.level])}>{e.rate}%</span>
            </>
          )}
        </div>
        <span className={cn(COL.num, num, 'hidden md:block')}>{e.onTime}</span>
        <span className={cn(COL.num, num, 'hidden md:block', e.late > 0 && 'text-negative-text')}>{e.late}</span>
        <span className={cn(COL.num, num, 'hidden sm:block', e.lateMinutes > 0 && 'text-negative-text')}>{e.lateMinutes}</span>
        <span className={cn(COL.num, num, 'hidden sm:block', e.absences > 0 && 'text-negative-text')}>{e.absences}</span>
        <span className={cn(COL.num, num, 'hidden lg:block')}>{e.earlyLeaves}</span>
        <ChevronDown size={16} strokeWidth={1.5} className={cn('shrink-0 text-mid-gray transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 sm:pl-28">
          {e.lateDays.length === 0 ? (
            <p className="text-body text-mid-gray">
              {e.measured > 0 ? 'Llegó a tiempo todos los días con horario.' : 'No tiene días con horario en este periodo.'}
              {e.absences > 0 && ` Faltó ${e.absences} ${e.absences === 1 ? 'vez' : 'veces'}.`}
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-caption font-semibold uppercase tracking-wider text-mid-gray">Llegadas tarde</p>
              {e.lateDays.map((d) => (
                <div key={d.date} className="flex max-w-md items-center justify-between gap-4 text-body text-graphite">
                  <span>{shortDay(d.date)}</span>
                  <span className="text-mid-gray">turno {d.scheduledStart}</span>
                  <span className="w-20 text-right tabular-nums text-negative-text">+{d.minutesLate} min</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function shortDay(date: string): string {
  const s = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
