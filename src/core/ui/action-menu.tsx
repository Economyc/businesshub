import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ActionMenuItem =
  | { label: string; icon?: LucideIcon; onClick: () => void; disabled?: boolean }
  | { separator: true }

interface ActionMenuProps {
  label: string
  /** Icono inicial del trigger (ej. Plus). */
  icon?: LucideIcon
  items: ActionMenuItem[]
  variant?: 'primary' | 'secondary'
}

const TRIGGER_BASE =
  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-body font-medium transition-all duration-200'
const TRIGGER_VARIANT: Record<'primary' | 'secondary', string> = {
  primary: 'btn-primary',
  secondary: 'border border-input-border text-graphite hover:bg-bone',
}

export function ActionMenu({ label, icon: Icon, items, variant = 'primary' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${TRIGGER_BASE} ${TRIGGER_VARIANT[variant]}`}
      >
        {Icon && <Icon size={15} strokeWidth={1.5} />}
        {label}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`opacity-70 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-64 bg-surface-elevated rounded-xl border border-border shadow-lg z-50 p-1.5">
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-border/60" />
            ) : (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors hover:bg-bone disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {item.icon && <item.icon size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
