import type { ReactNode } from 'react'

export interface FilterPillOption<T extends string> {
  value: T
  label: ReactNode
  count?: number
}

interface FilterPillGroupProps<T extends string> {
  label?: string
  options: FilterPillOption<T>[]
  value: T
  onChange: (value: T) => void
  hideZeroCount?: boolean
}

export function FilterPillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hideZeroCount = false,
}: FilterPillGroupProps<T>) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && <span className="text-caption text-mid-gray mr-0.5">{label}</span>}
      {options.map((opt) => {
        if (hideZeroCount && opt.count === 0) return null
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`h-7 px-3 inline-flex items-center gap-1.5 rounded-full text-caption transition-colors ${
              active
                ? 'bg-dark-graphite text-white'
                : 'bg-bone text-graphite hover:bg-mid-gray/20'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className={active ? 'text-white/70' : 'text-mid-gray'}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
