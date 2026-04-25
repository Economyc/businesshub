import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface DateRange {
  start: Date
  end: Date
}

interface DateRangeContextValue {
  startDate: Date
  endDate: Date
  activePreset: string
  presetLabel: string
  setPreset: (key: string) => void
  setCustomRange: (start: Date, end: Date) => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export interface DateRangePreset {
  key: string
  label: string
  getRange: () => DateRange
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(23, 59, 59, 999)
  return r
}

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return startOfDay(monday)
}

export const DATE_PRESETS: DateRangePreset[] = [
  {
    key: 'today',
    label: 'Hoy',
    getRange: () => {
      const now = new Date()
      return { start: startOfDay(now), end: endOfDay(now) }
    },
  },
  {
    key: 'yesterday',
    label: 'Ayer',
    getRange: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return { start: startOfDay(d), end: endOfDay(d) }
    },
  },
  {
    key: 'last7',
    label: 'Últimos 7 días',
    getRange: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return { start: startOfDay(start), end: endOfDay(now) }
    },
  },
  {
    key: 'last30',
    label: 'Últimos 30 días',
    getRange: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(now.getDate() - 29)
      return { start: startOfDay(start), end: endOfDay(now) }
    },
  },
  {
    key: 'thisWeek',
    label: 'Esta semana',
    getRange: () => {
      const now = new Date()
      return { start: getMondayOfWeek(now), end: endOfDay(now) }
    },
  },
  {
    key: 'lastWeek',
    label: 'Semana anterior',
    getRange: () => {
      const now = new Date()
      const thisMonday = getMondayOfWeek(now)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      return { start: startOfDay(lastMonday), end: endOfDay(lastSunday) }
    },
  },
  {
    key: 'thisMonth',
    label: 'Este mes',
    getRange: () => {
      const now = new Date()
      return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) }
    },
  },
  {
    key: 'lastMonth',
    label: 'Mes anterior',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: startOfDay(start), end: endOfDay(end) }
    },
  },
  {
    key: 'yearToDate',
    label: 'Año hasta hoy',
    getRange: () => {
      const now = new Date()
      return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: endOfDay(now) }
    },
  },
]

function getPresetRange(key: string): DateRange {
  const preset = DATE_PRESETS.find((p) => p.key === key)
  return preset ? preset.getRange() : DATE_PRESETS.find((p) => p.key === 'thisMonth')!.getRange()
}

function getPresetLabel(key: string): string {
  const preset = DATE_PRESETS.find((p) => p.key === key)
  return preset ? preset.label : 'Personalizado'
}

function formatRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const defaultRange = getPresetRange('thisMonth')
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [activePreset, setActivePreset] = useState('thisMonth')

  const setPreset = useCallback((key: string) => {
    const range = getPresetRange(key)
    setStartDate(range.start)
    setEndDate(range.end)
    setActivePreset(key)
  }, [])

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setStartDate(startOfDay(start))
    setEndDate(endOfDay(end))
    setActivePreset('custom')
  }, [])

  const presetLabel = activePreset === 'custom'
    ? formatRangeLabel(startDate, endDate)
    : getPresetLabel(activePreset)

  const value = useMemo<DateRangeContextValue>(
    () => ({ startDate, endDate, activePreset, presetLabel, setPreset, setCustomRange }),
    [startDate, endDate, activePreset, presetLabel, setPreset, setCustomRange],
  )

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext)
  if (!ctx) throw new Error('useDateRange must be used within DateRangeProvider')
  return ctx
}
