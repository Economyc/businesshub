import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTH_NAMES, monthRange, prevMonthOf } from '@/core/pnl/month.ts'

interface MonthPickerProps {
  /** Mes activo en formato 'YYYY-MM'. */
  value: string
  onChange: (ym: string) => void
  /** Cuántos meses ofrecer hacia atrás en el desplegable. */
  months?: number
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function nextMonthOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 'YYYY-MM' del mes corriente. */
export function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/**
 * Selector de UN mes. No se reutiliza `DateRangePicker` porque ese habla de
 * rangos arbitrarios y el cierre siempre es un mes calendario completo: dejar
 * elegir "últimos 7 días" para un Estado de Resultados invita a un informe que
 * no cuadra con nada.
 *
 * No deja avanzar más allá del mes corriente: un cierre futuro no existe.
 */
export function MonthPicker({ value, onChange, months = 18, className }: MonthPickerProps) {
  const max = currentYm()
  const options: string[] = []
  let ym = max
  for (let i = 0; i < months; i++) {
    options.push(ym)
    ym = prevMonthOf(ym)
  }
  if (!options.includes(value)) options.unshift(value)

  const atMax = value >= max
  const label = (v: string) => {
    const [y, m] = v.split('-').map(Number)
    return `${MONTH_NAMES[m - 1]} ${y}`
  }

  const btn = 'flex h-9 w-9 items-center justify-center rounded-lg border border-border text-mid-gray transition-colors hover:border-border-hover hover:text-graphite disabled:opacity-40 disabled:hover:border-border disabled:hover:text-mid-gray'

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onChange(prevMonthOf(value))}
        className={btn}
        aria-label="Mes anterior"
      >
        <ChevronLeft size={16} strokeWidth={1.5} />
      </button>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Mes del cierre"
        className="h-9 min-w-40 rounded-lg border border-border bg-card-bg px-4 text-body text-graphite transition-colors hover:border-border-hover focus:border-border-hover focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{label(o)}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onChange(nextMonthOf(value))}
        disabled={atMax}
        className={btn}
        aria-label="Mes siguiente"
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}

/** Rango del mes, por si el consumidor necesita fechas. */
export { monthRange }
