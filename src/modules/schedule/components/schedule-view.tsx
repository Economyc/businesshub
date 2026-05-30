import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Copy, Send, Settings2, Plus, AlertTriangle, Clock, Tag, Lock, Check } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { useAuth } from '@/core/hooks/use-auth'
import { usePermissions } from '@/core/hooks/use-permissions'
import { queryClient } from '@/core/query/query-client'
import { useActiveEmployees } from '@/modules/talent/hooks'
import type { Employee } from '@/modules/talent/types'
import type { Shift, Novelty } from '../types'
import { scheduleService } from '../services'
import {
  useShifts,
  useScheduleWeek,
  useShiftTemplates,
  useUpdateShift,
  useNovelties,
  useNoveltyTypes,
} from '../hooks'
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
  buildScheduleSheet,
  WEEKDAY_LABELS,
} from './schedule-utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { CellForm } from './cell-form'
import { TemplateManager } from './template-manager'
import { NoveltyTypeManager } from './novelty-type-manager'
import { NOVELTY_COLORS } from './novelty-colors'
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
  novelty?: Novelty
}

export function ScheduleView({ allowedDepartments }: { allowedDepartments?: string[] }) {
  const { selectedCompany } = useCompany()
  const { user } = useAuth()
  const { can, isOwner } = usePermissions()
  const canEdit = can('schedule', 'create')

  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [noveltyTypesOpen, setNoveltyTypesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // Copiar semana → replicar a semanas seleccionadas.
  const [copyOpen, setCopyOpen] = useState(false)
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [weekInfo, setWeekInfo] = useState<Record<string, { hasData: boolean; isPublished: boolean }>>({})
  const [loadingWeeks, setLoadingWeeks] = useState(false)

  const weekKey = weekKeyOf(monday)
  const dates = useMemo(() => weekDates(monday), [monday])
  const gridRef = useRef<HTMLDivElement>(null)

  const { data: allEmployees, loading: empLoading } = useActiveEmployees()
  const { data: allShifts, refetch: refetchShifts } = useShifts(weekKey)
  const { data: allNovelties, refetch: refetchNovelties } = useNovelties(weekKey)
  const { week, refetch: refetchWeek } = useScheduleWeek(weekKey)
  const { data: templates } = useShiftTemplates()
  const { data: noveltyTypes } = useNoveltyTypes()
  const updateShift = useUpdateShift()

  // Drag & drop: arrastrar turnos entre celdas (empleado × día).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeShift, setActiveShift] = useState<Shift | null>(null)

  function handleDragStart(e: DragStartEvent) {
    setActiveShift((e.active.data.current?.shift as Shift) ?? null)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveShift(null)
    // Semana publicada = bloqueada (el draggable ya queda disabled, esto es defensa extra).
    if (isPublished) return
    const shift = e.active.data.current?.shift as Shift | undefined
    const target = e.over?.data.current as { employeeId: string; date: string } | undefined
    if (!shift || !target || !selectedCompany) return
    if (target.employeeId === shift.employeeId && target.date === shift.date) return
    // No se permiten turnos en un día marcado como novedad.
    if (noveltyByCell.has(`${target.employeeId}|${target.date}`)) return

    // Optimista: mueve el turno en la cache para feedback inmediato; la mutación
    // invalida y reconcilia con el servidor (rollback incluido si falla).
    const cacheKey = ['firestore', selectedCompany.id, 'shifts', weekKey]
    queryClient.setQueryData<Shift[]>(cacheKey, (old) =>
      old?.map((s) => (s.id === shift.id ? { ...s, employeeId: target.employeeId, date: target.date } : s)) ?? [],
    )
    updateShift.mutate({ id: shift.id, data: { employeeId: target.employeeId, date: target.date } })
  }

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
  const novelties = useMemo(
    () => (allowedDepartments ? allNovelties.filter((n) => visibleEmpIds.has(n.employeeId)) : allNovelties),
    [allNovelties, visibleEmpIds, allowedDepartments],
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

  // Índice empId|date → novedad (una por celda; reemplaza el día).
  const noveltyByCell = useMemo(() => {
    const map = new Map<string, Novelty>()
    for (const n of novelties) map.set(`${n.employeeId}|${n.date}`, n)
    return map
  }, [novelties])

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
  // Publicar congela la semana: la grilla pasa a solo-lectura hasta despublicar.
  const editable = canEdit && !isPublished

  // Las próximas 8 semanas como posibles destinos para replicar el horario actual.
  const targetWeeks = useMemo(
    () => Array.from({ length: 8 }, (_, i) => {
      const m = addWeeks(monday, i + 1)
      return { monday: m, weekKey: weekKeyOf(m), label: weekLabel(m) }
    }),
    [monday],
  )
  // ¿Hay algo en la semana visible para copiar? (sin filtrar por departamento)
  const canCopy = allShifts.length > 0 || allNovelties.length > 0
  // Semanas marcadas que sí se pueden escribir (excluye las publicadas).
  const selectedValidCount = targetWeeks.filter(
    (w) => targets.has(w.weekKey) && !weekInfo[w.weekKey]?.isPublished,
  ).length

  // Al abrir el popover, releva el estado de cada semana destino (tiene datos / publicada).
  async function openCopy() {
    if (!selectedCompany) return
    setTargets(new Set())
    setWeekInfo({})
    setCopyOpen(true)
    setLoadingWeeks(true)
    try {
      const entries = await Promise.all(targetWeeks.map(async (w) => {
        const [s, n, wk] = await Promise.all([
          scheduleService.getShiftsByWeek(selectedCompany.id, w.weekKey),
          scheduleService.getNoveltiesByWeek(selectedCompany.id, w.weekKey),
          scheduleService.getWeek(selectedCompany.id, w.weekKey),
        ])
        return [w.weekKey, { hasData: s.length > 0 || n.length > 0, isPublished: wk.status === 'published' }] as const
      }))
      setWeekInfo(Object.fromEntries(entries))
    } finally {
      setLoadingWeeks(false)
    }
  }

  function toggleTarget(weekKey: string) {
    setTargets((prev) => {
      const next = new Set(prev)
      if (next.has(weekKey)) next.delete(weekKey)
      else next.add(weekKey)
      return next
    })
  }

  // Replica la semana visible (todos los departamentos) a las semanas marcadas;
  // reemplaza por completo el contenido previo de cada destino.
  async function replicate() {
    if (!selectedCompany || busy) return
    const chosen = targetWeeks.filter((w) => targets.has(w.weekKey) && !weekInfo[w.weekKey]?.isPublished)
    if (chosen.length === 0) return
    setBusy(true)
    try {
      for (const w of chosen) {
        const destDates = weekDates(w.monday)
        const dateMap: Record<string, string> = {}
        dates.forEach((d, i) => { dateMap[d] = destDates[i] })
        await scheduleService.clearWeek(selectedCompany.id, w.weekKey)
        await Promise.all([
          scheduleService.copyWeek(selectedCompany.id, allShifts, w.weekKey, dateMap),
          scheduleService.copyNovelties(selectedCompany.id, allNovelties, w.weekKey, dateMap),
        ])
        queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'shifts', w.weekKey] })
        queryClient.invalidateQueries({ queryKey: ['firestore', selectedCompany.id, 'novelties', w.weekKey] })
      }
      setCopyOpen(false)
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
            <Popover open={copyOpen} onOpenChange={(o: boolean) => (o ? openCopy() : setCopyOpen(false))}>
              <PopoverTrigger
                type="button"
                disabled={busy || !canCopy}
                title={canCopy ? 'Copiar esta semana a otras semanas' : 'No hay horario para copiar'}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
              >
                <Copy size={15} strokeWidth={1.5} />
                Copiar semana
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0">
                <div className="px-3 py-2.5 border-b border-border/60">
                  <p className="text-body font-semibold text-graphite">Copiar a otras semanas</p>
                  <p className="text-caption text-mid-gray">Marca a cuáles replicar este horario.</p>
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {loadingWeeks ? (
                    <p className="px-2 py-3 text-caption text-mid-gray">Cargando semanas…</p>
                  ) : (
                    targetWeeks.map((w) => {
                      const info = weekInfo[w.weekKey]
                      const published = info?.isPublished
                      const selected = targets.has(w.weekKey)
                      return (
                        <button
                          key={w.weekKey}
                          type="button"
                          disabled={published}
                          onClick={() => toggleTarget(w.weekKey)}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-bone transition-colors duration-150 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        >
                          <span
                            className={
                              selected
                                ? 'flex items-center justify-center w-4 h-4 rounded border bg-graphite border-graphite text-bone'
                                : 'flex items-center justify-center w-4 h-4 rounded border border-input-border'
                            }
                          >
                            {selected && <Check size={11} strokeWidth={2.5} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-body text-graphite truncate">{w.label}</span>
                            {published ? (
                              <span className="text-caption text-mid-gray">Publicada — no editable</span>
                            ) : info?.hasData ? (
                              <span className="text-caption text-warning-text">Tiene horario — se reemplazará</span>
                            ) : null}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                <div className="px-3 py-2.5 border-t border-border/60">
                  <button
                    type="button"
                    onClick={replicate}
                    disabled={busy || selectedValidCount === 0}
                    className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-graphite text-bone text-body hover:opacity-90 transition-all duration-200 disabled:opacity-50"
                  >
                    {busy ? 'Replicando…' : selectedValidCount > 0 ? `Replicar (${selectedValidCount})` : 'Replicar'}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              title="Plantillas de turnos"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200"
            >
              <Settings2 size={15} strokeWidth={1.5} />
              Plantillas
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => setNoveltyTypesOpen(true)}
                title="Plantillas de novedades"
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200"
              >
                <Tag size={15} strokeWidth={1.5} />
                Novedades
              </button>
            )}
          </>
        )}
        <ScheduleExport
          targetRef={gridRef}
          fileName={`horario-${weekKey}`}
          getExcelSheets={() =>
            buildScheduleSheet({
              weekName: `Semana ${weekLabel(monday)}`,
              dates,
              groups,
              byCell,
              noveltyByCell,
              metrics,
              weekTotal,
              shifts,
            })
          }
        />
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
          <div className="flex items-center gap-2">
            {isPublished && (
              <span className="text-caption text-mid-gray inline-flex items-center gap-1">
                <Lock size={12} strokeWidth={1.5} />
                Edición bloqueada — despublica para modificar
              </span>
            )}
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
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <div className="min-w-[760px] xl:min-w-[940px] 2xl:min-w-[1100px]">
          {/* Fila de días */}
          <div className={`grid border-b border-border/60 ${gridColsClass}`}>
            <div className="sticky left-0 bg-card-bg px-3 py-2 text-body font-semibold text-mid-gray">Empleado</div>
            {dates.map((d, i) => (
              <div key={d} className="px-3 py-2 text-center">
                <p className="text-body font-semibold text-mid-gray">{WEEKDAY_LABELS[i]}</p>
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
                <div className="bg-bone/30 px-3 py-1.5 text-body tracking-wide text-mid-gray border-b border-border-hover/70">
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
                        const cellKey = `${emp.id}|${d}`
                        const cellNovelty = noveltyByCell.get(cellKey)
                        const cellShifts = cellNovelty ? [] : (byCell.get(cellKey) ?? [])
                        return (
                          <DroppableCell
                            key={d}
                            employeeId={emp.id}
                            date={d}
                            canEdit={editable}
                            onClick={
                              editable && !cellNovelty
                                ? () => setFormTarget({ date: d, employee: emp })
                                : undefined
                            }
                          >
                            {cellNovelty ? (
                              <NoveltyChip
                                novelty={cellNovelty}
                                canEdit={editable}
                                onEdit={() => setFormTarget({ date: d, employee: emp, novelty: cellNovelty })}
                              />
                            ) : (
                              <>
                                {cellShifts.map((s) => (
                                  <DraggableShift
                                    key={s.id}
                                    shift={s}
                                    canEdit={editable}
                                    onEdit={() => setFormTarget({ date: d, employee: emp, shift: s })}
                                  />
                                ))}
                                {editable && cellShifts.length === 0 && (
                                  <span className="hidden group-hover/cell:flex absolute inset-0 items-center justify-center text-mid-gray/60 pointer-events-none">
                                    <Plus size={14} strokeWidth={1.5} />
                                  </span>
                                )}
                              </>
                            )}
                          </DroppableCell>
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
            <div className="sticky left-0 bg-card-bg px-3 py-2 text-body font-semibold text-mid-gray">
              Total semana: <span className="text-graphite">{formatHours(weekTotal)}</span>
            </div>
            {dates.map((d) => {
              const dayHours = totalHours(shifts.filter((s) => s.date === d))
              return (
                <div key={d} className="px-3 py-2 text-center text-body text-mid-gray">
                  {dayHours > 0 ? formatHours(dayHours) : '—'}
                </div>
              )
            })}
          </div>
        </div>
        <DragOverlay>
          {activeShift ? (
            <div className="@container/chip rounded-lg border border-positive-text/40 bg-positive-bg px-2 py-1 cursor-grabbing">
              <ShiftChipContent shift={activeShift} />
            </div>
          ) : null}
        </DragOverlay>
        </DndContext>
      </div>

      {formTarget && (
        <CellForm
          open
          onClose={() => setFormTarget(null)}
          weekKey={weekKey}
          date={formTarget.date}
          employee={formTarget.employee}
          shift={formTarget.shift}
          novelty={formTarget.novelty}
          templates={templates}
          noveltyTypes={noveltyTypes}
          dayShifts={byCell.get(`${formTarget.employee.id}|${formTarget.date}`) ?? []}
          onSaved={() => { refetchShifts(); refetchNovelties() }}
        />
      )}

      <TemplateManager
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
        onChanged={() => { /* React Query invalida solo vía mutación */ }}
      />

      <NoveltyTypeManager
        open={noveltyTypesOpen}
        onClose={() => setNoveltyTypesOpen(false)}
        noveltyTypes={noveltyTypes}
        onChanged={() => { /* React Query invalida solo vía mutación */ }}
      />
    </div>
  )
}

// Contenido visual de un chip de turno (compartido entre el chip arrastrable y
// el clon que sigue al cursor en el DragOverlay).
function ShiftChipContent({ shift }: { shift: Shift }) {
  return (
    <>
      <span className="block text-caption text-positive-text font-medium whitespace-nowrap @[140px]/chip:hidden">{formatShiftRangeCompact(shift.start, shift.end)}</span>
      <span className="hidden text-caption text-positive-text font-medium whitespace-nowrap @[140px]/chip:block">{formatShiftRange(shift.start, shift.end)}</span>
      <span className="block text-caption text-positive-text/70">
        {formatHours(shiftHours(shift.start, shift.end, shift.breakMin))}
        {shift.notes ? ' · ' + shift.notes : ''}
      </span>
    </>
  )
}

// Chip de turno arrastrable. Click (sin mover) = editar; arrastrar = mover de
// celda. El sensor con activationConstraint distance:6 distingue click de drag.
function DraggableShift({ shift, canEdit, onEdit }: { shift: Shift; canEdit: boolean; onEdit: () => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
    disabled: !canEdit,
  })
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={canEdit ? (e) => { e.stopPropagation(); onEdit() } : undefined}
      style={{ touchAction: 'none' }}
      className={
        '@container/chip w-full text-left rounded-lg border border-positive-text/15 bg-positive-bg px-2 py-1 transition-colors hover:border-positive-text/35 ' +
        (canEdit ? 'cursor-grab ' : '') +
        (isDragging ? 'opacity-40' : '')
      }
    >
      <ShiftChipContent shift={shift} />
    </button>
  )
}

// Chip de novedad (ocupa el día completo). Clickeable para editar; NO es
// arrastrable porque una novedad no se mueve entre celdas como un turno.
function NoveltyChip({ novelty, canEdit, onEdit }: { novelty: Novelty; canEdit: boolean; onEdit: () => void }) {
  const chipClass = NOVELTY_COLORS[novelty.color]?.chip ?? NOVELTY_COLORS.gray.chip
  return (
    <button
      type="button"
      onClick={canEdit ? (e) => { e.stopPropagation(); onEdit() } : undefined}
      className={
        'w-full text-left rounded-lg border px-2 py-1 transition-colors ' +
        chipClass +
        (canEdit ? ' cursor-pointer' : '')
      }
    >
      <span className="block text-caption font-medium whitespace-nowrap truncate">{novelty.typeName}</span>
      {novelty.notes && <span className="block text-caption opacity-70 truncate">{novelty.notes}</span>}
    </button>
  )
}

// Celda (empleado × día) donde se sueltan los turnos. Resalta al pasar un turno
// por encima. Mantiene el click para crear un turno nuevo en la celda vacía.
function DroppableCell({
  employeeId,
  date,
  canEdit,
  onClick,
  children,
}: {
  employeeId: string
  date: string
  canEdit: boolean
  onClick?: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${employeeId}|${date}`, data: { employeeId, date } })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={
        'relative px-1.5 py-1.5 border-r border-border-hover/70 last:border-r-0 space-y-1 min-h-[52px] group/cell transition-colors ' +
        (canEdit ? 'cursor-pointer ' : '') +
        (isOver ? 'bg-smoke ring-1 ring-inset ring-graphite/20' : canEdit ? 'hover:bg-smoke/60' : '')
      }
    >
      {children}
    </div>
  )
}
