import { useState, useRef, useEffect } from 'react'
import { Download } from 'lucide-react'
import { exportToExcel, exportToCSV, type FieldDef } from '@/core/utils/data-transfer'

interface Props<T> {
  data: T[]
  fields: FieldDef[]
  filenameBase: string
}

export function ExportButton<T>({ data, fields, filenameBase }: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const date = new Date().toISOString().slice(0, 10)
  const filename = `${filenameBase}_${date}`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
      >
        <Download size={15} strokeWidth={2} />
        Exportar
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface-elevated rounded-xl border border-border shadow-lg z-20 py-1">
          <button
            onClick={() => { exportToExcel(data, fields, filename); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-body text-graphite hover:bg-bone transition-colors"
          >
            Excel (.xlsx)
          </button>
          <button
            onClick={() => { exportToCSV(data, fields, filename); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-body text-graphite hover:bg-bone transition-colors"
          >
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  )
}
