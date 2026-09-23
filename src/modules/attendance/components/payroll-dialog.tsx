import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SelectInput } from '@/core/ui/select-input'
import { SearchInput } from '@/core/ui/search-input'
import { useCompany } from '@/core/hooks/use-company'
import { exportSheetsToExcel, type SheetSpec } from '@/core/utils/data-transfer'
import { useEmployees } from '@/modules/talent/hooks'
import { cn } from '@/lib/utils'
import { useAttendanceConfig, useSaveAttendanceConfig } from '../hooks'
import { attendanceService } from '../services'
import { normalizeName } from '../use-attendance-rows'
import { buildWorkdays, WORKDAY_STATUS_LABEL } from '../shifts'
import {
  breakRuleFor,
  buildPayrollWeekSheets,
  CONSOLIDAR_NOVELTIES,
  fortnightRange,
  isoWeeksCovering,
  payableFor,
  scheduledPayables,
  type Payable,
} from '../payroll'

// Descarga para nomina: un horario-AAAA-Wnn.xlsx por semana ISO de la quincena
// (incluidas las de borde) con las horas que se pagan. Esos archivos se corren
// con Nominas - Empresas/_script/consolidar.py, igual que los de Filipo.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Ultimos 12 meses, del mas reciente al mas viejo. value = 'AAAA-M'. */
function monthOptions(now = new Date()) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${capitalize(MONTHS[d.getMonth()])} ${d.getFullYear()}` }
  })
}

interface Prepared {
  sheets: { fileName: string; sheets: SheetSpec[] }[]
  blockers: { employeeName: string; date: string; status: string }[]
  noShift: number
  approved: number
  scheduled: number
  employees: number
  unknownNovelties: string[]
}

export function PayrollDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">{open && <Body onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const { selectedCompany } = useCompany()
  const { data: employees } = useEmployees()
  const { config } = useAttendanceConfig()
  const saveConfig = useSaveAttendanceConfig()
  const months = useMemo(() => monthOptions(), [])
  const [month, setMonth] = useState(months[0].value)
  // Por defecto la quincena en curso: la segunda si ya pasamos del 15.
  const [q, setQ] = useState<1 | 2>(new Date().getDate() > 15 ? 2 : 1)
  const [y, m] = month.split('-').map(Number)
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rule = breakRuleFor(selectedCompany?.name ?? '')

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [employees],
  )
  const scheduleOnly = new Set(config.scheduleOnlyEmployeeIds)
  const [search, setSearch] = useState('')
  const visibleEmployees = useMemo(() => {
    const q = normalizeName(search.trim())
    return q ? activeEmployees.filter((e) => normalizeName(e.name).includes(q)) : activeEmployees
  }, [activeEmployees, search])

  function toggleScheduleOnly(id: string) {
    const next = new Set(scheduleOnly)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveConfig.mutate({ scheduleOnlyEmployeeIds: [...next] })
    setPrepared(null)
  }

  async function prepare() {
    if (!selectedCompany || !rule) return
    setBusy(true)
    setError(null)
    try {
      const { from, to } = fortnightRange(y, m, q)
      const weeks = isoWeeksCovering(from, to)
      const rangeFrom = weeks[0].dates[0]
      const rangeTo = weeks[weeks.length - 1].dates[6]
      const cid = selectedCompany.id
      const [punches, shifts, novelties] = await Promise.all([
        attendanceService.getPunchesByRange(cid, rangeFrom, rangeTo),
        attendanceService.getScheduledShifts(cid, rangeFrom, rangeTo),
        attendanceService.getNoveltiesByRange(cid, rangeFrom, rangeTo),
      ])

      const workdays = buildWorkdays(punches, Date.now()).filter(
        (w) => w.date >= rangeFrom && w.date <= rangeTo && !scheduleOnly.has(w.employeeId),
      )
      const blockers = workdays
        .filter((w) => w.status !== 'complete')
        .map((w) => ({ employeeName: w.employeeName, date: w.date, status: WORKDAY_STATUS_LABEL[w.status] }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const payables: Payable[] = [
        ...workdays
          .map((w) => payableFor(w, shifts, !!w.inPunch?.extraApprovedBy))
          .filter((p): p is Payable => p !== null),
        ...scheduledPayables(shifts, scheduleOnly),
      ]

      const people = employees.map((e) => ({
        id: e.id, name: e.name, identification: e.identification ?? '', department: e.department ?? '',
      }))
      const unknownNovelties = [...new Set(novelties.map((n) => n.typeName).filter((t) => !CONSOLIDAR_NOVELTIES.has(t)))]

      setPrepared({
        sheets: weeks.map((week) => ({
          fileName: week.fileName,
          sheets: buildPayrollWeekSheets({ week, employees: people, payables, novelties, rule }),
        })),
        blockers,
        noShift: payables.filter((p) => p.kind === 'no-shift').length,
        approved: payables.filter((p) => p.kind === 'approved').length,
        scheduled: payables.filter((p) => p.kind === 'scheduled').length,
        employees: new Set(payables.map((p) => p.employeeId)).size,
        unknownNovelties,
      })
    } catch {
      setError('No se pudieron cargar las marcaciones. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!prepared) return
    setBusy(true)
    try {
      for (const f of prepared.sheets) await exportSheetsToExcel(f.sheets, f.fileName)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const blocked = !!prepared && (prepared.blockers.length > 0 || prepared.unknownNovelties.length > 0)
  const folder = `${y}/${String(m).padStart(2, '0')} - ${capitalize(MONTHS[m - 1])}/<SEDE>/`

  return (
    <>
      <DialogHeader>
        <DialogTitle>Descargar para nómina</DialogTitle>
        <DialogDescription>Un archivo por semana para correr con consolidar.py.</DialogDescription>
      </DialogHeader>

      {!rule ? (
        <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">
          {selectedCompany?.name} no es una sede de Blue ni de Filipo: no hay regla de nómina para ella.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mes">
              <SelectInput value={month} onChange={(v) => { setMonth(v); setPrepared(null) }} options={months} />
            </Field>
            <Field label="Quincena">
              {/* Misma caja que el SelectInput del mes (borde 1px + 2px de aire + boton
                  py-2 = py-2.5 del select), para que los dos queden del mismo alto. */}
              <div className="flex gap-1 rounded-lg border border-input-border bg-bone p-0.5">
                {([1, 2] as const).map((n) => {
                  const r = fortnightRange(y, m, n)
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setQ(n); setPrepared(null) }}
                      className={cn(
                        'flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-center text-body transition-colors',
                        q === n ? 'bg-card-bg font-medium text-dark-graphite' : 'text-mid-gray hover:text-graphite',
                      )}
                    >
                      Q{n} <span className={q === n ? 'text-mid-gray' : ''}>| {Number(r.from.slice(8))} al {Number(r.to.slice(8))}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-body font-medium text-dark-graphite">
              Selecciona empleados
            </p>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar empleado..." />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
              {visibleEmployees.length === 0 && <p className="px-2 py-1 text-body text-mid-gray">Sin resultados</p>}
              {visibleEmployees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-body text-graphite hover:bg-bone">
                  <input type="checkbox" checked={scheduleOnly.has(e.id)} onChange={() => toggleScheduleOnly(e.id)} />
                  {e.name}
                </label>
              ))}
            </div>
          </div>

          {prepared && (
            <div className="space-y-2">
              {prepared.blockers.length > 0 && (
                <div className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">
                  <p className="flex items-center gap-2 font-medium"><AlertTriangle size={16} strokeWidth={1.5} /> Corrige estas jornadas antes de descargar</p>
                  <ul className="mt-2 space-y-1">
                    {prepared.blockers.map((b) => (
                      <li key={`${b.employeeName}-${b.date}`}>{b.date} · {b.employeeName} · {b.status}</li>
                    ))}
                  </ul>
                </div>
              )}
              {prepared.unknownNovelties.length > 0 && (
                <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">
                  consolidar.py no reconoce estas novedades: {prepared.unknownNovelties.join(', ')}.
                </p>
              )}
              {!blocked && (
                <div className="rounded-lg bg-positive-bg p-4 text-body text-positive-text">
                  <p className="flex items-center gap-2 font-medium"><CheckCircle2 size={16} strokeWidth={1.5} /> Listo: {prepared.sheets.length} semanas, {prepared.employees} empleados</p>
                  <ul className="mt-2 space-y-1">
                    {prepared.noShift > 0 && <li>{prepared.noShift} jornadas sin horario, pagadas por lo marcado</li>}
                    {prepared.approved > 0 && <li>{prepared.approved} jornadas con extra aprobado</li>}
                    {prepared.scheduled > 0 && <li>{prepared.scheduled} turnos pagados por horario</li>}
                  </ul>
                  <p className="mt-2 text-caption">Guárdalos en {folder}</p>
                </div>
              )}
            </div>
          )}
          {error && <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">{error}</p>}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {prepared && !blocked ? (
          <Button onClick={download} disabled={busy}>
            {busy ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Download size={16} strokeWidth={1.5} />}
            Descargar {prepared.sheets.length} archivos
          </Button>
        ) : (
          <Button onClick={prepare} disabled={busy || !rule}>
            {busy && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {prepared ? 'Revisar de nuevo' : 'Preparar'}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-2')}>
      <p className="text-caption font-semibold uppercase tracking-wider text-mid-gray">{label}</p>
      {children}
    </div>
  )
}
