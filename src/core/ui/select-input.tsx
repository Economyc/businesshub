import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

interface SelectInputProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
}

export function SelectInput({ value, onChange, options, placeholder = 'Seleccionar...', className }: SelectInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

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

  function handleSelect(optionValue: string) {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-lg border bg-input-bg text-body transition-all duration-200 cursor-pointer',
          open
            ? 'border-input-focus ring-[3px] ring-graphite/5'
            : 'border-input-border hover:border-border-hover'
        )}
      >
        <span className={selected ? 'text-graphite' : 'text-mid-gray/60'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={cn('text-mid-gray shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden max-h-[220px] overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-body text-left transition-colors duration-100',
                value === option.value
                  ? 'bg-bone text-dark-graphite font-medium'
                  : 'text-graphite hover:bg-bone/50'
              )}
            >
              {option.label}
              {value === option.value && <Check size={14} className="text-graphite shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
