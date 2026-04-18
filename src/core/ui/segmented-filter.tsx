import type { ReactNode } from 'react'

export interface SegmentedFilterOption<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

interface SegmentedFilterProps<T extends string> {
  options: SegmentedFilterOption<T>[]
  value: T
  onChange: (value: T) => void
  hideZeroCount?: boolean
  ariaLabel?: string
}

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  hideZeroCount = false,
  ariaLabel,
}: SegmentedFilterProps<T>) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        if (hideZeroCount && opt.count === 0) return null
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-caption transition-colors ${
              active
                ? 'bg-surface text-dark-graphite font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]'
                : 'text-graphite hover:text-dark-graphite'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`tabular-nums ${active ? 'text-mid-gray' : 'text-mid-gray/80'}`}
              >
                {opt.count.toLocaleString('es-CO')}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
