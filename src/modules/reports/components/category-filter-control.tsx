import { FilterPopover } from '@/core/ui/filter-popover'
import { SegmentedFilter } from '@/core/ui/segmented-filter'
import type { CategoryFilter, CategoryFilterMode, CategoryOption } from '../domain/category-filter'

interface CategoryFilterControlProps {
  options: CategoryOption[]
  value: CategoryFilter
  onChange: (value: CategoryFilter) => void
}

const MODES: { value: CategoryFilterMode; label: string }[] = [
  { value: 'include', label: 'Solo estas' },
  { value: 'exclude', label: 'Todas menos estas' },
]

export function CategoryFilterControl({ options, value, onChange }: CategoryFilterControlProps) {
  const selected = new Set(value.categories)
  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange({ ...value, categories: [...next] })
  }

  return (
    <FilterPopover activeCount={value.categories.length} onClear={() => onChange({ ...value, categories: [] })}>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-mid-gray">Categorías</span>
        <div className="self-start rounded-lg bg-smoke p-0.5">
          <SegmentedFilter
            options={MODES}
            value={value.mode}
            onChange={(mode) => onChange({ ...value, mode })}
            ariaLabel="Cómo aplicar las categorías"
          />
        </div>
      </div>
      {options.length === 0 ? (
        <p className="text-caption text-mid-gray">No hay categorías en este periodo.</p>
      ) : (
        <ul className="-mx-1 max-h-72 overflow-y-auto">
          {options.map((opt) => (
            <li key={opt.key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-body text-graphite hover:bg-bone">
                <input
                  type="checkbox"
                  checked={selected.has(opt.key)}
                  onChange={() => toggle(opt.key)}
                  className="size-4 cursor-pointer accent-dark-graphite"
                />
                <span className="flex-1 truncate">{opt.label}</span>
                <span className="text-caption tabular-nums text-mid-gray">{opt.units.toLocaleString('es-CO')}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </FilterPopover>
  )
}

/** "Solo Hamburguesas, Papas" / "Sin Bebidas": el filtro activo, visible fuera del popover. */
export function describeCategoryFilter(value: CategoryFilter, options: CategoryOption[]): string | null {
  if (value.categories.length === 0) return null
  const labels = value.categories.map((k) => options.find((o) => o.key === k)?.label ?? k)
  return `${value.mode === 'include' ? 'Solo' : 'Sin'} ${labels.join(', ')}`
}
