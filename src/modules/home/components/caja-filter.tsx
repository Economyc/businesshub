import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Store, ChevronDown, Check } from 'lucide-react'
import { useHomeFilters } from '../context/home-filters-context'

interface CajaFilterProps {
  cajas: Array<[string, number]>
}

export function CajaFilter({ cajas }: CajaFilterProps) {
  const { selectedCaja, setSelectedCaja } = useHomeFilters()
  const [open, setOpen] = useState(false)
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

  if (cajas.length <= 1) return null

  const label = selectedCaja === 'todas' ? 'Todas las cajas' : `Caja ${selectedCaja}`

  const handleSelect = (value: string) => {
    setSelectedCaja(value)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite hover:bg-bone transition-all duration-200 cursor-pointer whitespace-nowrap"
      >
        <Store size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
        <span className="font-medium text-dark-graphite">{label}</span>
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
            className="fixed left-2 right-2 bottom-2 sm:bottom-auto sm:left-auto sm:right-0 sm:absolute sm:top-full sm:mt-1.5 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden sm:min-w-[220px]"
          >
            <div className="py-2">
              <button
                onClick={() => handleSelect('todas')}
                className={`w-full flex items-center justify-between px-4 py-2 text-body transition-colors duration-150 ${
                  selectedCaja === 'todas'
                    ? 'bg-bone text-dark-graphite font-medium'
                    : 'text-graphite hover:bg-bone/50'
                }`}
              >
                <span>Todas las cajas</span>
                {selectedCaja === 'todas' && (
                  <Check size={14} strokeWidth={2} className="text-graphite" />
                )}
              </button>
              <div className="border-t border-border mt-1 pt-1">
                {cajas.map(([id, count]) => (
                  <button
                    key={id}
                    onClick={() => handleSelect(id)}
                    className={`w-full flex items-center justify-between px-4 py-2 text-body transition-colors duration-150 ${
                      selectedCaja === id
                        ? 'bg-bone text-dark-graphite font-medium'
                        : 'text-graphite hover:bg-bone/50'
                    }`}
                  >
                    <span>Caja {id} · {count}</span>
                    {selectedCaja === id && (
                      <Check size={14} strokeWidth={2} className="text-graphite" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
