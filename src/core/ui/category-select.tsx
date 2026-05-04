import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronRight, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoverHint } from '@/components/ui/tooltip'
import { useSettings } from '@/core/hooks/use-settings'
import { parseCategory, formatCategory } from '@/core/utils/categories'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowCustom?: boolean
  className?: string
}

export function CategorySelect({ value, onChange, placeholder = 'Seleccionar categoría...', allowCustom = false, className }: CategorySelectProps) {
  const { categories } = useSettings()
  const [open, setOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  const parsed = value ? parseCategory(value) : null

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCustomMode(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); setCustomMode(false) }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (customMode && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [customMode])

  function handleSelectCategory(catName: string, catId: string, hasSubs: boolean) {
    if (hasSubs) {
      setExpandedId((prev) => (prev === catId ? null : catId))
    } else {
      onChange(catName)
      setOpen(false)
      setExpandedId(null)
    }
  }

  function handleSelectSubcategory(catName: string, sub: string) {
    onChange(formatCategory(catName, sub))
    setOpen(false)
    setExpandedId(null)
  }

  function handleSelectParentOnly(catName: string) {
    onChange(catName)
    setOpen(false)
    setExpandedId(null)
  }

  function handleCustomSubmit() {
    const trimmed = customValue.trim()
    if (trimmed) {
      onChange(trimmed)
      setCustomValue('')
      setCustomMode(false)
      setOpen(false)
    }
  }

  // Display value
  const displayColor = parsed
    ? categories.find((c) => c.name === parsed.category)?.color
    : undefined

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
        <span className={cn('flex items-center gap-2 min-w-0', !value && 'text-mid-gray/60')}>
          {displayColor && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: displayColor }} />
          )}
          <span className="truncate">
            {value || placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={cn('text-mid-gray shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden max-h-[280px] overflow-y-auto">
          {categories.map((cat) => {
            const isExpanded = expandedId === cat.id
            const hasSubs = cat.subcategories.length > 0
            const isSelected = parsed?.category === cat.name && !parsed?.subcategory

            return (
              <div key={cat.id}>
                {/* Category row */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(cat.name, cat.id, hasSubs)}
                    className={cn(
                      'flex-1 flex items-center gap-2.5 px-3 py-2 text-body text-left transition-colors duration-100',
                      isSelected
                        ? 'bg-bone text-dark-graphite font-medium'
                        : 'text-graphite hover:bg-bone/50'
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1">{cat.name}</span>
                    {hasSubs && (
                      <ChevronRight
                        size={12}
                        strokeWidth={1.5}
                        className={cn('text-mid-gray transition-transform duration-200', isExpanded && 'rotate-90')}
                      />
                    )}
                    {isSelected && <Check size={14} className="text-graphite shrink-0" />}
                  </button>
                  {hasSubs && isExpanded && (
                    <HoverHint label={`Solo "${cat.name}"`}>
                      <button
                        type="button"
                        onClick={() => handleSelectParentOnly(cat.name)}
                        className="px-2 py-1 mr-1 text-[11px] text-mid-gray hover:text-graphite hover:bg-bone rounded transition-colors"
                      >
                        Todas
                      </button>
                    </HoverHint>
                  )}
                </div>

                {/* Subcategories */}
                {hasSubs && isExpanded && (
                  <div className="ml-4 border-l-2 border-border">
                    {cat.subcategories.map((sub) => {
                      const subSelected = parsed?.category === cat.name && parsed?.subcategory === sub
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSelectSubcategory(cat.name, sub)}
                          className={cn(
                            'w-full flex items-center justify-between pl-4 pr-3 py-1.5 text-body text-left transition-colors duration-100',
                            subSelected
                              ? 'bg-bone text-dark-graphite font-medium'
                              : 'text-mid-gray hover:bg-bone/50 hover:text-graphite'
                          )}
                        >
                          {sub}
                          {subSelected && <Check size={12} className="text-graphite shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Custom option */}
          {allowCustom && (
            <div className="border-t border-border mt-1 pt-1">
              {customMode ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    ref={customInputRef}
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCustomSubmit() }
                      if (e.key === 'Escape') { setCustomMode(false); setCustomValue('') }
                    }}
                    placeholder="Nombre..."
                    className="flex-1 px-2 py-1 rounded-md border border-input-border text-caption text-graphite placeholder:text-mid-gray/50 focus:border-input-focus outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    disabled={!customValue.trim()}
                    className="p-1 rounded-md btn-primary disabled:opacity-40"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-body text-mid-gray hover:text-graphite hover:bg-bone/50 transition-colors"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Otra...
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
