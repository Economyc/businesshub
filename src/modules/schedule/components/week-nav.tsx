import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  label: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function WeekNav({ label, onPrev, onNext, onToday }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
        aria-label="Semana anterior"
      >
        <ChevronLeft size={18} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onToday}
        className="min-w-[12rem] text-center text-body font-semibold text-graphite px-3 py-2 rounded-lg hover:bg-bone transition-colors"
        title="Ir a la semana actual"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
        aria-label="Semana siguiente"
      >
        <ChevronRight size={18} strokeWidth={1.5} />
      </button>
    </div>
  )
}
