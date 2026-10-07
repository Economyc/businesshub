import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MONTHS_FULL, DAYS, todayISO, buildCalendarDays } from '@/core/ui/calendar-utils'

interface DateRangeCalendarProps {
  /** Rango vigente en ISO (YYYY-MM-DD). */
  start: string
  end: string
  /** Se llama al completar el segundo clic, con el rango ya ordenado. */
  onSelect: (start: string, end: string) => void
}

// Años del selector: desde (año actual + 1) hasta 2015, descendente.
const YEAR_OPTIONS = (() => {
  const max = new Date().getFullYear() + 1
  const years: number[] = []
  for (let y = max; y >= 2015; y--) years.push(y)
  return years
})()

function formatLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/**
 * Calendario de rango en un solo campo: el primer clic fija "desde", el
 * segundo fija "hasta" (se ordenan solos) y dispara onSelect. Dos meses en
 * escritorio, uno en móvil.
 */
export function DateRangeCalendar({ start, end, onSelect }: DateRangeCalendarProps) {
  const initial = start ? new Date(start + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const next = addMonths(viewYear, viewMonth, 1)
  const months = useMemo(
    () => [
      { year: viewYear, month: viewMonth, days: buildCalendarDays(viewYear, viewMonth) },
      { year: next.year, month: next.month, days: buildCalendarDays(next.year, next.month) },
    ],
    [viewYear, viewMonth, next.year, next.month],
  )

  // Rango a pintar: la vista previa mientras se elige, o el rango vigente.
  let lo = start
  let hi = end
  if (anchor) {
    const other = hovered ?? anchor
    lo = anchor < other ? anchor : other
    hi = anchor < other ? other : anchor
  }

  const today = todayISO()

  function shift(delta: number) {
    const r = addMonths(viewYear, viewMonth, delta)
    setViewYear(r.year)
    setViewMonth(r.month)
  }

  function handleDayClick(iso: string) {
    if (!anchor) {
      setAnchor(iso)
      return
    }
    const [a, b] = anchor <= iso ? [anchor, iso] : [iso, anchor]
    setAnchor(null)
    setHovered(null)
    onSelect(a, b)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen del rango */}
      <div className="flex items-center gap-2 text-body">
        <span className={cn('font-medium', anchor ? 'text-dark-graphite' : 'text-graphite')}>
          {formatLabel(anchor ?? start)}
        </span>
        <span className="text-mid-gray">→</span>
        {anchor ? (
          <span className="text-mid-gray">Elige el día final</span>
        ) : (
          <span className="font-medium text-graphite">{formatLabel(end)}</span>
        )}
      </div>

      {/* Navegación de mes */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite shrink-0"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>

        <div className="flex flex-1 items-center justify-center gap-2">
          <div className="relative">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
              className="appearance-none rounded-lg border border-input-border bg-input-bg pl-2 pr-6 py-1 text-body text-dark-graphite font-medium cursor-pointer hover:border-border-hover transition-colors focus:outline-none focus:border-input-focus"
              aria-label="Mes"
            >
              {MONTHS_FULL.map((name, i) => (
                <option key={name} value={i}>{name}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-mid-gray"
            />
          </div>
          <div className="relative">
            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              className="appearance-none rounded-lg border border-input-border bg-input-bg pl-2 pr-6 py-1 text-body text-dark-graphite font-medium cursor-pointer hover:border-border-hover transition-colors focus:outline-none focus:border-input-focus"
              aria-label="Año"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-mid-gray"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => shift(1)}
          className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite shrink-0"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Meses */}
      <div className="flex gap-6" onMouseLeave={() => setHovered(null)}>
        {months.map((m, idx) => (
          <div key={`${m.year}-${m.month}`} className={cn('w-full sm:w-[252px]', idx === 1 && 'hidden sm:block')}>
            <div className="text-center text-caption text-mid-gray mb-1">
              {MONTHS_FULL[m.month]} {m.year}
            </div>
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-caption text-mid-gray py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {m.days.map((d, i) => {
                // Los días de relleno de otros meses no se muestran: con dos
                // meses lado a lado saldrían repetidos.
                if (!d.current) return <div key={i} className="h-8" />
                const isEdge = d.iso === lo || d.iso === hi
                const inRange = d.iso > lo && d.iso < hi
                const isToday = d.iso === today
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDayClick(d.iso)}
                    onMouseEnter={() => anchor && setHovered(d.iso)}
                    className={cn(
                      'h-8 text-caption transition-colors duration-100',
                      isEdge && 'btn-primary font-medium rounded-lg',
                      inRange && 'bg-bone text-dark-graphite',
                      !isEdge && !inRange && 'text-graphite hover:bg-bone rounded-lg',
                      isToday && !isEdge && 'font-medium ring-1 ring-inset ring-graphite/20 rounded-lg',
                    )}
                  >
                    {d.day}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
