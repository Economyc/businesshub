import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronDown, Check } from 'lucide-react'
import { DateInput } from '@/core/ui/date-input'
import { useDateRange, DATE_PRESETS } from '../context/date-range-context'

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DateRangePicker() {
  const { activePreset, presetLabel, setPreset, setCustomRange, startDate, endDate } = useDateRange()
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(activePreset === 'custom')
  const [customFrom, setCustomFrom] = useState(toISO(startDate))
  const [customTo, setCustomTo] = useState(toISO(endDate))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  const handlePreset = (key: string) => {
    setPreset(key)
    setShowCustom(false)
    setOpen(false)
  }

  const handleCustomClick = () => {
    setShowCustom(true)
    setCustomFrom(toISO(startDate))
    setCustomTo(toISO(endDate))
  }

  const applyCustom = () => {
    if (customFrom && customTo) {
      setCustomRange(new Date(customFrom + 'T00:00:00'), new Date(customTo + 'T00:00:00'))
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 cursor-pointer whitespace-nowrap"
      >
        <Calendar size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
        <span className="font-medium text-dark-graphite">{presetLabel}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`text-mid-gray transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-1.5 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 flex flex-col sm:flex-row overflow-hidden max-w-[calc(100vw-2rem)]"
          >
            {/* Presets list */}
            <div className="w-full sm:w-[200px] py-2 border-b sm:border-b-0 sm:border-r border-border">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset.key)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-body transition-colors duration-150 ${
                    activePreset === preset.key && !showCustom
                      ? 'bg-bone text-dark-graphite font-medium'
                      : 'text-graphite hover:bg-bone/50'
                  }`}
                >
                  <span>{preset.label}</span>
                  {activePreset === preset.key && !showCustom && (
                    <Check size={14} strokeWidth={2} className="text-graphite" />
                  )}
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={handleCustomClick}
                  className={`w-full flex items-center justify-between px-4 py-2 text-body transition-colors duration-150 ${
                    showCustom || activePreset === 'custom'
                      ? 'bg-bone text-dark-graphite font-medium'
                      : 'text-graphite hover:bg-bone/50'
                  }`}
                >
                  <span>Personalizado</span>
                  {activePreset === 'custom' && (
                    <Check size={14} strokeWidth={2} className="text-graphite" />
                  )}
                </button>
              </div>
            </div>

            {/* Custom date pickers */}
            <AnimatePresence>
              {showCustom && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden sm:!h-auto"
                  style={{ width: 'auto' }}
                >
                  <div className="w-full sm:w-[260px] p-4 flex flex-col gap-3">
                    <div>
                      <label className="block text-caption text-mid-gray mb-1.5">Desde</label>
                      <DateInput value={customFrom} onChange={setCustomFrom} />
                    </div>
                    <div>
                      <label className="block text-caption text-mid-gray mb-1.5">Hasta</label>
                      <DateInput value={customTo} onChange={setCustomTo} />
                    </div>
                    <button
                      onClick={applyCustom}
                      disabled={!customFrom || !customTo}
                      className="w-full py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                    >
                      Aplicar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
