import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DateInput } from '@/core/ui/date-input'
import { useCompany } from '@/core/hooks/use-company'
import { exportSheetsToExcel } from '@/core/utils/data-transfer'
import type { Employee } from '@/modules/talent/types'
import { scheduleService } from '../services'
import { buildScheduleRangeSheet, datesBetween } from './schedule-utils'

/** Tope del rango: dos meses. Mas columnas no se leen en un Excel. */
const MAX_DAYS = 62

interface Props {
  open: boolean
  onClose: () => void
  groups: { department: string; employees: Employee[] }[]
  /** Rango inicial: la semana que se esta viendo. */
  defaultFrom: string
  defaultTo: string
}

/** Descarga del horario en Excel para un rango libre de fechas. */
export function ScheduleRangeExport({ open, onClose, groups, defaultFrom, defaultTo }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {open && <Body onClose={onClose} groups={groups} defaultFrom={defaultFrom} defaultTo={defaultTo} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ onClose, groups, defaultFrom, defaultTo }: Omit<Props, 'open'>) {
  const { selectedCompany } = useCompany()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    if (!selectedCompany) return
    setError(null)
    if (!from || !to) return setError('Elige las dos fechas.')
    if (to < from) return setError('La fecha final es anterior a la inicial.')
    const dates = datesBetween(from, to)
    if (dates.length > MAX_DAYS) return setError(`Máximo ${MAX_DAYS} días por descarga.`)
    setBusy(true)
    try {
      const [shifts, novelties] = await Promise.all([
        scheduleService.getShiftsByRange(selectedCompany.id, from, to),
        scheduleService.getNoveltiesByRange(selectedCompany.id, from, to),
      ])
      const sheets = buildScheduleRangeSheet({ title: 'Horario', dates, groups, shifts, novelties })
      await exportSheetsToExcel(sheets, `horario-${from}-a-${to}`)
      onClose()
    } catch {
      setError('No se pudo generar la descarga. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Descargar horario por fechas</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wider text-mid-gray">Desde</p>
          <DateInput value={from} onChange={setFrom} />
        </div>
        <div className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wider text-mid-gray">Hasta</p>
          <DateInput value={to} onChange={setTo} />
        </div>
      </div>
      {error && <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={download} disabled={busy}>
          {busy ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Download size={16} strokeWidth={1.5} />}
          Descargar Excel
        </Button>
      </DialogFooter>
    </>
  )
}
