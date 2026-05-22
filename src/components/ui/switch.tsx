import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  'aria-label'?: string
}

const SIZES = {
  sm: { track: 'h-4 w-7', knob: 'h-3 w-3', on: 'translate-x-3.5', off: 'translate-x-0.5' },
  md: { track: 'h-5 w-9', knob: 'h-4 w-4', on: 'translate-x-4', off: 'translate-x-0.5' },
} as const

/** Toggle plano on/off siguiendo el Design System (rounded-full, tokens, sin sombras). */
export function Switch({ checked, onCheckedChange, disabled, size = 'md', ...rest }: SwitchProps) {
  const s = SIZES[size]
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-graphite/10',
        s.track,
        checked ? 'bg-positive-bg border-positive-text/30' : 'bg-smoke border-border',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block rounded-full transition-transform duration-150',
          s.knob,
          checked ? `${s.on} bg-positive-text` : `${s.off} bg-mid-gray`,
        )}
      />
    </button>
  )
}
