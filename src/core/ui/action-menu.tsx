import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

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
  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-body font-medium transition-all duration-200 cursor-pointer'
const TRIGGER_VARIANT: Record<'primary' | 'secondary', string> = {
  primary: 'btn-primary',
  secondary: 'border border-input-border text-graphite hover:bg-bone',
}

export function ActionMenu({ label, icon: Icon, items, variant = 'primary' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={(v: boolean) => setOpen(v)}>
      <PopoverTrigger className={`${TRIGGER_BASE} ${TRIGGER_VARIANT[variant]}`}>
        {Icon && <Icon size={15} strokeWidth={1.5} />}
        <span>{label}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="opacity-70" />
      </PopoverTrigger>
      <PopoverContent className="min-w-64 p-2">
        <div className="flex flex-col">
          {items.map((item, i) =>
            'separator' in item ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-border/60" />
            ) : (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors hover:bg-bone disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {item.icon && <item.icon size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
