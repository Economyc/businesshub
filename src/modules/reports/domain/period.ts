// Periodos de los informes en días calendario locales ("YYYY-MM-DD").
//
// Se trabaja con strings y no con Date a propósito: `fecha` del POS ya viene
// como texto local de la sede, y comparar strings evita que un cambio de zona
// horaria corra un pedido de las 23:30 al día siguiente.

export interface ReportPeriod {
  start: string
  end: string
}

export interface WeekBucket {
  start: string
  end: string
  label: string
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const pad = (n: number) => String(n).padStart(2, '0')

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number)
  return [y, m, d]
}

function fromParts(y: number, m: number, d: number): string {
  // Date normaliza desbordes (día 0 = último del mes anterior, día 32 = siguiente).
  return toYmd(new Date(y, m - 1, d))
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = parts(ymd)
  return fromParts(y, m, d + n)
}

/** Días del periodo, contando ambos extremos. */
export function periodLength(p: ReportPeriod): number {
  const [ys, ms, ds] = parts(p.start)
  const [ye, me, de] = parts(p.end)
  const ms1 = Date.UTC(ys, ms - 1, ds)
  const ms2 = Date.UTC(ye, me - 1, de)
  return Math.round((ms2 - ms1) / 86_400_000) + 1
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

export function isFullMonth(p: ReportPeriod): boolean {
  const [ys, ms, ds] = parts(p.start)
  const [ye, me, de] = parts(p.end)
  return ys === ye && ms === me && ds === 1 && de === lastDayOfMonth(ye, me)
}

/**
 * Periodo con el que se compara. Un mes completo se compara con el mes anterior
 * completo (agosto → julio, marzo → febrero de 28/29 días); cualquier otro rango,
 * con uno de la misma duración inmediatamente antes.
 */
export function previousPeriod(p: ReportPeriod): ReportPeriod {
  if (isFullMonth(p)) {
    const [y, m] = parts(p.start)
    return { start: fromParts(y, m - 1, 1), end: fromParts(y, m, 0) }
  }
  const len = periodLength(p)
  return { start: addDays(p.start, -len), end: addDays(p.start, -1) }
}

export function enumerateDays(p: ReportPeriod): string[] {
  const days: string[] = []
  for (let d = p.start; d <= p.end; d = addDays(d, 1)) days.push(d)
  return days
}

/** Bloques de 7 días desde el inicio del periodo; el último puede ser más corto. */
export function weekBuckets(p: ReportPeriod): WeekBucket[] {
  const buckets: WeekBucket[] = []
  for (let start = p.start; start <= p.end; start = addDays(start, 7)) {
    const candidate = addDays(start, 6)
    const end = candidate > p.end ? p.end : candidate
    buckets.push({ start, end, label: formatRangeShort(start, end) })
  }
  return buckets
}

// ── Horas en formato de 12 horas (a. m. / p. m.), como se lee en Colombia ──

function hour12(h: number): { hour: number; suffix: string } {
  return { hour: h % 12 === 0 ? 12 : h % 12, suffix: h < 12 ? 'a. m.' : 'p. m.' }
}

/** "18:05" → "6:05 p. m."; "00:30" → "12:30 a. m.". Vacío si no hay hora. */
export function formatTime12(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!match) return ''
  const { hour, suffix } = hour12(Number(match[1]))
  return `${hour}:${match[2]} ${suffix}`
}

/** 18 → "6:00 – 6:59 p. m." */
export function formatHourBand(h: number): string {
  const { hour, suffix } = hour12(h)
  return `${hour}:00 – ${hour}:59 ${suffix}`
}

/** "1 ago" */
export function formatDayShort(ymd: string): string {
  const [, m, d] = parts(ymd)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

/** "vie" */
export function weekdayShort(ymd: string): string {
  const [y, m, d] = parts(ymd)
  return WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()]
}

/** Índice lunes=0 … domingo=6. */
export function weekdayIndexMondayFirst(ymd: string): number {
  const [y, m, d] = parts(ymd)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

/** "1 al 7 ago" o "29 ago al 4 sep" */
function formatRangeShort(start: string, end: string): string {
  const [, ms, ds] = parts(start)
  const [, me, de] = parts(end)
  if (start === end) return formatDayShort(start)
  if (ms === me) return `${ds} al ${de} ${MONTHS_SHORT[me - 1]}`
  return `${formatDayShort(start)} al ${formatDayShort(end)}`
}

/** "agosto de 2026" para un mes completo; "1 al 15 de agosto de 2026" o "20 ago 2026 al 3 sep 2026" si no. */
export function formatPeriodLabel(p: ReportPeriod): string {
  const [ys, ms, ds] = parts(p.start)
  const [ye, me, de] = parts(p.end)
  if (isFullMonth(p)) return `${MONTHS_LONG[ms - 1]} de ${ys}`
  if (ys === ye && ms === me) {
    return ds === de ? `${ds} de ${MONTHS_LONG[ms - 1]} de ${ys}` : `${ds} al ${de} de ${MONTHS_LONG[ms - 1]} de ${ys}`
  }
  return `${ds} ${MONTHS_SHORT[ms - 1]} ${ys} al ${de} ${MONTHS_SHORT[me - 1]} ${ye}`
}

/** Parte del nombre de archivo: "2026-08" para un mes completo, "2026-08-01_a_2026-08-15" si no. */
export function periodSlug(p: ReportPeriod): string {
  if (isFullMonth(p)) return p.start.slice(0, 7)
  return p.start === p.end ? p.start : `${p.start}_a_${p.end}`
}
