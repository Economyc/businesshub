import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

const DROPDOWN_MAX_HEIGHT = 220
const GAP = 4

interface MenuCoords {
  left: number
  width: number
  top: number | null
  bottom: number | null
}

export function SelectInput({ value, onChange, options, placeholder = 'Seleccionar...', className }: SelectInputProps) {
  const [open, setOpen] = useState(false)
  // El menú se renderiza vía portal en <body> con position:fixed para que no
  // lo recorten contenedores con overflow-hidden / overflow-y-auto (modales,
  // tarjetas). La posición se calcula desde el rect del botón.
  const [coords, setCoords] = useState<MenuCoords | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const dropUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
    setCoords({
      left: rect.left,
      width: rect.width,
      top: dropUp ? null : rect.bottom + GAP,
      bottom: dropUp ? window.innerHeight - rect.top + GAP : null,
    })
  }, [])

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const inButton = ref.current?.contains(target)
      const inMenu = menuRef.current?.contains(target)
      if (!inButton && !inMenu) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    // Capture en scroll para reposicionar aunque el scroll sea de un
    // contenedor interno (modal con overflow-y-auto).
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  function handleSelect(optionValue: string) {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
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

      {open && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: coords.left,
            width: coords.width,
            ...(coords.top != null ? { top: coords.top } : {}),
            ...(coords.bottom != null ? { bottom: coords.bottom } : {}),
          }}
          className="bg-surface-elevated border border-border rounded-xl shadow-lg z-[100] py-1 overflow-hidden max-h-[220px] overflow-y-auto"
        >
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
        </div>,
        document.body,
      )}
    </div>
  )
}
