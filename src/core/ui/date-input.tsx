import { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

function formatDisplayDate(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-')
  return `${parseInt(day, 10)} ${MONTHS[parseInt(month, 10) - 1].toLowerCase()} ${year}`
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

export function DateInput({ value, onChange, required, className }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parse value or default to today for calendar view
  const parsed = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      function handleKey(e: KeyboardEvent) {
        if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
      }
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKey)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKey)
      }
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
    setOpen(false)
  }

  const todayISO = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required
          tabIndex={-1}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          onChange={() => {}}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 rounded-[10px] border bg-input-bg text-body transition-all duration-200 cursor-pointer',
          open
            ? 'border-input-focus ring-[3px] ring-graphite/5'
            : 'border-input-border hover:border-border-hover'
        )}
      >
        <Calendar size={16} strokeWidth={1.5} className="text-mid-gray shrink-0" />
        <span className={cn('flex-1 text-left', value ? 'text-graphite' : 'text-mid-gray/60')}>
          {value ? formatDisplayDate(value) : 'dd/mm/aaaa'}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 p-3 w-[280px]">
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="text-body font-medium text-dark-graphite">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-bone transition-colors text-mid-gray hover:text-dark-graphite"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] uppercase tracking-wider text-mid-gray py-1">
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
        </div>
      )}
    </div>
  )
}
