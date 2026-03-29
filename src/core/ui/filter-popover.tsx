import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface FilterPopoverProps {
  activeCount: number
  onClear: () => void
  children: ReactNode
}

export function FilterPopover({ activeCount, onClear, children }: FilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite transition-all duration-200 hover:bg-bone cursor-pointer"
      >
        <SlidersHorizontal size={15} strokeWidth={1.5} />
        <span>Filtros</span>
        {activeCount > 0 && (
          <span className="ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full btn-primary text-[11px] font-medium leading-none">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-3">
          {children}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 pt-3 border-t border-border w-full text-caption text-mid-gray hover:text-graphite transition-colors duration-150 text-left cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
