import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const PANEL_WIDTH = 280
const PANEL_HEIGHT = 330
const GAP = 4
const MARGIN = 8

const MIN_YEAR = 1920
// Años en orden descendente: desde (año actual + 5) hasta MIN_YEAR.
const YEAR_OPTIONS = (() => {
  const max = new Date().getFullYear() + 5
  const years: number[] = []
  for (let y = max; y >= MIN_YEAR; y--) years.push(y)
  return years
})()

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// ISO (YYYY-MM-DD) -> "dd/mm/aaaa" para el campo editable.
function formatTyped(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

// "dd/mm/aaaa" -> ISO si es una fecha real; null si no.
function parseTyped(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const year = parseInt(m[3], 10)
  if (month < 1 || month > 12) return null
  if (year < MIN_YEAR) return null
  // Días por mes considerando bisiesto.
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return null
  return toISO(year, month - 1, day)
}

// Inserta "/" automáticamente mientras se escribe dd/mm/aaaa.
function maskTyped(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts: string[] = []
  if (digits.length > 0) parts.push(digits.slice(0, 2))
  if (digits.length > 2) parts.push(digits.slice(2, 4))
  if (digits.length > 4) parts.push(digits.slice(4, 8))
  return parts.join('/')
}

export function DateInput({ value, onChange, required, className }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Texto visible en el campo editable.
  const [text, setText] = useState(() => formatTyped(value))

  // Parse value or default to today for calendar view
  const parsed = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  // Sync view + texto when value changes externally
  useEffect(() => {
    setText(formatTyped(value))
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  // Position the portal panel relative to the trigger, flipping up if needed.
  useLayoutEffect(() => {
    if (!open) return
    function reposition() {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(PANEL_WIDTH, window.innerWidth - MARGIN * 2)
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUp = spaceBelow < PANEL_HEIGHT + GAP && spaceAbove > spaceBelow
      const top = openUp ? rect.top - PANEL_HEIGHT - GAP : rect.bottom + GAP
      let left = rect.right - width
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))
      setPanelPos({ top, left, width })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const days: { day: number; current: boolean; iso: string }[] = []

    // Previous month padding
    const prevLastDay = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLastDay - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      days.push({ day: d, current: false, iso: toISO(y, m, d) })
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ day: d, current: true, iso: toISO(viewYear, viewMonth, d) })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      days.push({ day: d, current: false, iso: toISO(y, m, d) })
    }

    return days
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  function selectDay(iso: string) {
    onChange(iso)
    setText(formatTyped(iso))
    setOpen(false)
  }

  // Campo editable: máscara mientras se escribe + parseo cuando queda completo.
  function handleTextChange(raw: string) {
    const masked = maskTyped(raw)
    setText(masked)
    const iso = parseTyped(masked)
    if (iso) {
      onChange(iso)
      const d = new Date(iso + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else if (masked === '') {
      onChange('')
    }
  }

  // Al salir del campo: normalizar o revertir si quedó inválido.
  function handleTextBlur() {
    if (text === '') {
      onChange('')
      return
    }
    const iso = parseTyped(text)
    if (iso) {
      setText(formatTyped(iso))
    } else {
      setText(formatTyped(value))
    }
  }

  const todayISO = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border bg-input-bg text-body transition-all duration-200',
        open
          ? 'border-input-focus ring-[3px] ring-graphite/5'
          : 'border-input-border hover:border-border-hover',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="shrink-0 text-mid-gray hover:text-dark-graphite transition-colors cursor-pointer"
        aria-label="Abrir calendario"
      >
        <Calendar size={16} strokeWidth={1.5} />
      </button>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={text}
        required={required}
        placeholder="dd/mm/aaaa"
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={handleTextBlur}
        onFocus={() => setOpen(true)}
        className="flex-1 min-w-0 bg-transparent text-graphite placeholder:text-mid-gray/60 outline-none"
      />

      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          data-dateinput-panel=""
          className="fixed bg-surface-elevated border border-border rounded-xl shadow-lg p-3"
          style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width, zIndex: 60 }}
        >
          {/* Month/Year header */}
          <div className="flex items-center gap-1 mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite shrink-0"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>

            <div className="flex flex-1 items-center justify-center gap-1.5">
              {/* Selector de mes */}
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

              {/* Selector de año */}
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
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite shrink-0"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] uppercase tracking-wider font-semibold text-mid-gray py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((d, i) => {
              const isSelected = d.iso === value
              const isToday = d.iso === todayISO

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(d.iso)}
                  className={cn(
                    'h-8 rounded-lg text-[12px] transition-all duration-100',
                    !d.current && 'text-mid-gray/30',
                    d.current && !isSelected && 'text-graphite hover:bg-bone',
                    isSelected && 'btn-primary font-medium',
                    isToday && !isSelected && 'font-semibold text-dark-graphite ring-1 ring-graphite/20'
                  )}
                >
                  {d.day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-border flex justify-center">
            <button
              type="button"
              onClick={() => selectDay(todayISO)}
              className="text-[11px] text-mid-gray hover:text-graphite font-medium transition-colors"
            >
              Hoy
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
