import { useMemo, useRef, useState } from 'react'
import { Copy, Send, Settings2, Plus, AlertTriangle, Clock } from 'lucide-react'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useActiveEmployees } from '@/modules/talent/hooks'
import type { Employee } from '@/modules/talent/types'
import type { Shift } from '../types'
import { scheduleService } from '../services'
import { useShifts, useScheduleWeek, useShiftTemplates } from '../hooks'
import {
  mondayOf,
  weekKeyOf,
  weekDates,
  addWeeks,
  weekLabel,
  groupByDepartment,
  totalHours,
  shiftHours,
  formatHours,
  formatShiftRange,
  formatShiftRangeCompact,
  shiftsOverlap,
  parseDateStr,
  WEEKDAY_LABELS,
} from './schedule-utils'
import { ShiftForm } from './shift-form'
import { TemplateManager } from './template-manager'
import { WeekNav } from './week-nav'
import { ScheduleExport } from './schedule-export'

// Tope de horas semanales para la alerta blanda (referencia legal Colombia).
// Configurable a futuro por empresa; por ahora constante.
const MAX_WEEKLY_HOURS = 48

// Columnas de la grilla, responsive por breakpoint para que los 7 días entren
// con el sidebar abierto. base (<xl): compacto; xl (1280–1535): medio;
// 2xl (≥1536): tamaño completo. El `1fr` estira las columnas en pantallas anchas.
const gridColsClass =
  '[grid-template-columns:minmax(116px,150px)_repeat(7,minmax(92px,1fr))] ' +
  'xl:[grid-template-columns:minmax(150px,180px)_repeat(7,minmax(112px,1fr))] ' +
  '2xl:[grid-template-columns:minmax(180px,220px)_repeat(7,minmax(132px,1fr))]'

interface FormTarget {
  date: string
  employee: Employee
  shift?: Shift
}

export function ScheduleView({ allowedDepartments }: { allowedDepartments?: string[] }) {
  const { selectedCompany } = useCompany()
  const { user } = useAuth()
  const { can } = usePermissions()
  const canEdit = can('schedule', 'create')

  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const weekKey = weekKeyOf(monday)
  const dates = useMemo(() => weekDates(monday), [monday])
  const gridRef = useRef<HTMLDivElement>(null)

  const { data: allEmployees, loading: empLoading } = useActiveEmployees()
  const { data: allShifts, refetch: refetchShifts } = useShifts(weekKey)
  const { week, refetch: refetchWeek } = useScheduleWeek(weekKey)
  const { data: templates } = useShiftTemplates()

  // Filtro opcional por departamento: App2 sólo muestra Cocina y Servicio (los
  // que manejan horarios). Sin el prop se muestran todos los empleados.
  const employees = useMemo(() => {
    if (!allowedDepartments) return allEmployees
    const allow = new Set(allowedDepartments.map((d) => d.toLowerCase()))
    return allEmployees.filter((e) => allow.has((e.department ?? '').trim().toLowerCase()))
  }, [allEmployees, allowedDepartments])
  // Restringe los turnos a los empleados visibles para que métricas y totales
  // (semana, por día) cuadren con lo que se muestra en la grilla.
  const visibleEmpIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees])
  const shifts = useMemo(
    () => (allowedDepartments ? allShifts.filter((s) => visibleEmpIds.has(s.employeeId)) : allShifts),
    [allShifts, visibleEmpIds, allowedDepartments],
  )

  const groups = useMemo(() => groupByDepartment(employees), [employees])

  // Índice empId|date → turnos, para pintar cada celda en O(1).
  const byCell = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const s of shifts) {
      const key = `${s.employeeId}|${s.date}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start))
    return map
  }, [shifts])

  // Métricas y alertas por empleado.
  const metrics = useMemo(() => {
    const m = new Map<string, { hours: number; days: number; over: boolean; noRest: boolean; overlap: boolean }>()
    for (const emp of employees) {
      const es = shifts.filter((s) => s.employeeId === emp.id)
      const hours = totalHours(es)
      const days = new Set(es.map((s) => s.date)).size
      let overlap = false
      for (let i = 0; i < es.length && !overlap; i++)
        for (let j = i + 1; j < es.length; j++)
          if (shiftsOverlap(es[i], es[j])) { overlap = true; break }
      m.set(emp.id, {
        hours,
        days,
        over: hours > MAX_WEEKLY_HOURS,
        noRest: days >= 7,
        overlap,
      })
    }
    return m
  }, [employees, shifts])

  const weekTotal = useMemo(() => totalHours(shifts), [shifts])
  const isPublished = week.status === 'published'

  async function copyPrevWeek() {
    if (!selectedCompany || busy) return
    setBusy(true)
    try {
      const prevMonday = addWeeks(monday, -1)
      const prevShifts = await scheduleService.getShiftsByWeek(selectedCompany.id, weekKeyOf(prevMonday))
      if (prevShifts.length === 0) return
      const prevDates = weekDates(prevMonday)
      const dateMap: Record<string, string> = {}
      prevDates.forEach((d, i) => { dateMap[d] = dates[i] })
      await scheduleService.copyWeek(selectedCompany.id, prevShifts, weekKey, dateMap)
      await refetchShifts()
    } finally {
      setBusy(false)
    }
  }

  async function togglePublish() {
    if (!selectedCompany || busy) return
    setBusy(true)
    try {
      await scheduleService.setWeekStatus(
        selectedCompany.id,
        weekKey,
        isPublished ? 'draft' : 'published',
        user?.email ?? '',
      )
      await refetchWeek()
    } finally {
      setBusy(false)
    }
  }

  if (!selectedCompany) {
    return (
      <div>
        <p className="text-body text-mid-gray">Selecciona una empresa para ver el horario.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Horarios" subtitle={<span className="text-caption text-mid-gray">{selectedCompany.name}</span>}>
        <WeekNav
          label={weekLabel(monday)}
          onPrev={() => setMonday(addWeeks(monday, -1))}
          onNext={() => setMonday(addWeeks(monday, 1))}
          onToday={() => setMonday(mondayOf(new Date()))}
        />
        {canEdit && (
          <>
            <button
              type="button"
              onClick={copyPrevWeek}
              disabled={busy || shifts.length > 0}
              title={shifts.length > 0 ? 'La semana ya tiene turnos' : 'Copiar turnos de la semana anterior'}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
            >
              <Copy size={15} strokeWidth={1.5} />
              Copiar semana
            </button>
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200"
            >
              <Settings2 size={15} strokeWidth={1.5} />
              Plantillas
            </button>
          </>
        )}
        <ScheduleExport targetRef={gridRef} fileName={`horario-${weekKey}`} />
        {canEdit && (
          <button
            type="button"
            onClick={togglePublish}
            disabled={busy}
            className={
              isPublished
                ? 'flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50'
                : 'flex items-center gap-2 px-3.5 py-2 rounded-lg bg-graphite text-bone text-body hover:opacity-90 transition-all duration-200 disabled:opacity-50'
            }
          >
            <Send size={15} strokeWidth={1.5} />
            {isPublished ? 'Despublicar' : 'Publicar'}
          </button>
        )}
      </PageHeader>

      <div ref={gridRef} className="bg-card-bg rounded-xl border border-border/60 overflow-x-auto">
        {/* Encabezado imprimible */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
          <div>
            <p className="text-subheading font-semibold text-graphite">
              {selectedCompany.name}{selectedCompany.location ? ` - ${selectedCompany.location}` : ''}
            </p>
            <p className="text-caption text-mid-gray">Semana {weekLabel(monday)}</p>
          </div>
          <span
            className={
              isPublished
                ? 'text-caption px-2.5 py-1 rounded-full bg-positive-bg text-positive-text'
                : 'text-caption px-2.5 py-1 rounded-full bg-warning-bg text-warning-text'
            }
          >
            {isPublished ? 'Publicado' : 'Borrador'}
          </span>
        </div>

        <div className="min-w-[760px] xl:min-w-[940px] 2xl:min-w-[1100px]">
          {/* Fila de días */}
          <div className={`grid border-b border-border/60 ${gridColsClass}`}>
            <div className="sticky left-0 bg-card-bg px-3 py-2 text-caption font-semibold text-mid-gray">Empleado</div>
            {dates.map((d, i) => (
              <div key={d} className="px-3 py-2 text-center">
                <p className="text-caption font-semibold text-mid-gray">{WEEKDAY_LABELS[i]}</p>
                <p className="text-body text-graphite">{parseDateStr(d).getDate()}</p>
              </div>
            ))}
          </div>

          {empLoading && employees.length === 0 ? (
            <div className="px-4 py-8 text-center text-caption text-mid-gray">Cargando empleados…</div>
          ) : employees.length === 0 ? (
            <div className="px-4 py-8 text-center text-caption text-mid-gray">
              {allowedDepartments
                ? `No hay empleados en ${allowedDepartments.join(' o ')}. Asigna el departamento en Equipo.`
                : 'No hay empleados activos. Agrégalos en el módulo Equipo.'}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.department}>
                <div className="bg-bone/30 px-3 py-1.5 text-caption tracking-wide text-mid-gray border-b border-border-hover/70">
                  {group.department}
                </div>
                {group.employees.map((emp) => {
                  const mt = metrics.get(emp.id)
                  return (
                    <div key={emp.id} className={`grid border-b border-border-hover/70 last:border-b-0 bg-surface ${gridColsClass}`}>
                      <div className="sticky left-0 bg-surface px-3 py-2 border-r border-border-hover/70">
                        <p className="text-body text-graphite truncate">{emp.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-caption text-mid-gray inline-flex items-center gap-1">
                            <Clock size={12} strokeWidth={1.5} />
                            {formatHours(mt?.hours ?? 0)}
                          </span>
                          {mt?.over && (
                            <span title={`Supera ${MAX_WEEKLY_HOURS}h semanales`} className="text-caption text-negative-text inline-flex items-center gap-0.5">
                              <AlertTriangle size={12} strokeWidth={1.5} />
                            </span>
                          )}
                          {mt?.noRest && (
                            <span title="Sin día de descanso esta semana" className="text-caption text-warning-text inline-flex items-center gap-0.5">
                              <AlertTriangle size={12} strokeWidth={1.5} />
                            </span>
                          )}
                          {mt?.overlap && (
                            <span title="Tiene turnos solapados" className="text-caption text-negative-text inline-flex items-center gap-0.5">
                              <AlertTriangle size={12} strokeWidth={1.5} />
                            </span>
                          )}
                        </div>
                      </div>
                      {dates.map((d) => {
                        const cellShifts = byCell.get(`${emp.id}|${d}`) ?? []
                        return (
                          <div
                            key={d}
                            onClick={canEdit ? () => setFormTarget({ date: d, employee: emp }) : undefined}
                            className={
                              'px-1.5 py-1.5 border-r border-border-hover/70 last:border-r-0 space-y-1 min-h-[52px] group/cell ' +
                              (canEdit ? 'cursor-pointer hover:bg-smoke/60 transition-colors' : '')
                            }
                          >
                            {cellShifts.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={canEdit ? (e) => { e.stopPropagation(); setFormTarget({ date: d, employee: emp, shift: s }) } : undefined}
                                className="w-full text-left rounded-lg border border-positive-text/15 bg-positive-bg px-2 py-1 hover:border-positive-text/35 transition-colors"
                              >
                                <span className="block text-caption text-positive-text font-medium whitespace-nowrap 2xl:hidden">{formatShiftRangeCompact(s.start, s.end)}</span>
                                <span className="hidden 2xl:block text-caption text-positive-text font-medium whitespace-nowrap">{formatShiftRange(s.start, s.end)}</span>
                                <span className="block text-caption text-positive-text/70">
                                  {formatHours(shiftHours(s.start, s.end, s.breakMin))}
                                  {s.notes ? ' · ' + s.notes : ''}
                                </span>
                              </button>
                            ))}
                            {canEdit && cellShifts.length === 0 && (
                              <span className="hidden group-hover/cell:flex items-center justify-center text-mid-gray/60">
                                <Plus size={14} strokeWidth={1.5} />
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))
          )}

          {/* Footer de totales */}
          <div className={`grid border-t border-border/60 bg-bone/20 ${gridColsClass}`}>
            <div className="sticky left-0 bg-card-bg px-3 py-2 text-caption font-semibold text-mid-gray">
              Total semana: <span className="text-graphite">{formatHours(weekTotal)}</span>
            </div>
            {dates.map((d) => {
              const dayHours = totalHours(shifts.filter((s) => s.date === d))
              return (
                <div key={d} className="px-3 py-2 text-center text-caption text-mid-gray">
                  {dayHours > 0 ? formatHours(dayHours) : '—'}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {formTarget && (
        <ShiftForm
          open
          onClose={() => setFormTarget(null)}
          weekKey={weekKey}
          date={formTarget.date}
          employee={formTarget.employee}
          shift={formTarget.shift}
          templates={templates}
          onSaved={() => refetchShifts()}
        />
      )}

      <TemplateManager
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
        onChanged={() => { /* React Query invalida solo vía mutación */ }}
      />
    </div>
  )
}
