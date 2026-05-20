import { useState, useRef, useEffect } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { getAppFunctions } from '@/core/firebase/config'
import {
  exportSheetsToExcel,
  exportToCSV,
  type SheetSpec,
} from '@/core/utils/data-transfer'
import { ACCOUNTING_FIELDS, buildAccountingRows } from '../utils/accounting-export'
import type { Transaction } from '../types'

type Conjunto = 'pending' | 'paid' | 'both'
type DriveState = 'idle' | 'saving' | 'done' | 'error'

// Mismo orden que MESES_ES del backend (functions/utils/doc-naming) para que el
// mes del nombre del archivo coincida con la carpeta del mes en Drive.
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface Props {
  pending: Transaction[]
  paid: Transaction[]
  /** Map de id de proveedor → NIT (identification). */
  suppliersById: Map<string, string>
  companyId: string
}

export function InvoiceExportMenu({ pending, paid, suppliersById, companyId }: Props) {
  const [open, setOpen] = useState(false)
  const [conjunto, setConjunto] = useState<Conjunto>('pending')
  const [driveState, setDriveState] = useState<DriveState>('idle')
  const [driveLink, setDriveLink] = useState<string | null>(null)
  const [driveError, setDriveError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // El botón Drive siempre actúa sobre el MES EN CURSO, no sobre el filtro de
  // pantalla. La hoja ya se auto-actualiza; este botón es solo "actualízala ya",
  // y la pestaña "Pagadas" del servidor es el mes natural completo. Usar el
  // startDate del DateRangePicker hacía que con "Últimos 30 días" el texto y el
  // payload apuntaran a un mes distinto del que se ve.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth()
  const currentMonthLabel = MESES_ES[currentMonthIndex]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Resetea el estado del guardado en Drive cuando cambia el conjunto.
  useEffect(() => {
    setDriveState('idle')
    setDriveLink(null)
    setDriveError(null)
  }, [conjunto])

  function sheetsFor(target: Conjunto): SheetSpec[] {
    const pendientes: SheetSpec = {
      name: 'Pendientes',
      data: buildAccountingRows(pending, suppliersById),
      fields: ACCOUNTING_FIELDS,
    }
    const pagadas: SheetSpec = {
      name: 'Pagadas',
      data: buildAccountingRows(paid, suppliersById),
      fields: ACCOUNTING_FIELDS,
    }
    if (target === 'pending') return [pendientes]
    if (target === 'paid') return [pagadas]
    return [pendientes, pagadas]
  }

  const dateSuffix = new Date().toISOString().slice(0, 10)
  const filenameBase =
    conjunto === 'pending' ? 'facturas_pendientes' : conjunto === 'paid' ? 'facturas_pagadas' : 'facturas'

  async function handleExcel() {
    await exportSheetsToExcel(sheetsFor(conjunto), `${filenameBase}_${dateSuffix}`)
    setOpen(false)
  }

  async function handleCSV() {
    // CSV no tiene pestañas → solo para un conjunto.
    if (conjunto === 'both') return
    const [sheet] = sheetsFor(conjunto)
    await exportToCSV(sheet.data, ACCOUNTING_FIELDS, `${filenameBase}_${dateSuffix}`)
    setOpen(false)
  }

  async function handleDrive() {
    if (!companyId) {
      setDriveState('error')
      setDriveError('Selecciona una empresa primero.')
      return
    }
    setDriveState('saving')
    setDriveError(null)
    setDriveLink(null)
    try {
      // El servidor arma la hoja (regenerateInvoiceSheet): decide qué pestañas
      // van según la regla del mes (Pendientes solo en el mes actual). Por eso
      // aquí ya no se manda el .xlsx ni el `conjunto`.
      const fns = await getAppFunctions()
      const save = httpsCallable<
        { companyId: string; year: number; monthIndex: number },
        { driveFileId: string; webViewLink: string; fileName: string }
      >(fns, 'saveInvoiceSheetToDrive')
      const res = await save({
        companyId,
        year: currentYear,
        monthIndex: currentMonthIndex,
      })
      setDriveLink(res.data.webViewLink)
      setDriveState('done')
    } catch (err) {
      setDriveState('error')
      setDriveError((err as Error).message || 'No se pudo guardar en Drive.')
    }
  }

  const conjuntoOptions: { value: Conjunto; label: string; count: number }[] = [
    { value: 'pending', label: 'Pendientes', count: pending.length },
    { value: 'paid', label: 'Pagadas', count: paid.length },
    { value: 'both', label: 'Ambas', count: pending.length + paid.length },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
      >
        <Download size={15} strokeWidth={2} />
        Exportar
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-surface-elevated rounded-xl border border-border shadow-lg z-50 p-3">
          <p className="text-caption text-mid-gray mb-1.5">Qué exportar</p>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-bone/60 border border-border/60 w-full mb-3">
            {conjuntoOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setConjunto(opt.value)}
                className={`flex-1 px-2 py-1.5 rounded-md text-caption font-medium transition-colors ${
                  conjunto === opt.value
                    ? 'bg-surface text-graphite card-elevated'
                    : 'text-mid-gray hover:text-graphite'
                }`}
              >
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={handleExcel}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors hover:bg-bone"
            >
              <FileSpreadsheet size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              <span className="truncate">
                Descargar Excel{conjunto === 'both' ? ' (2 pestañas)' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCSV}
              disabled={conjunto === 'both'}
              title={conjunto === 'both' ? 'El CSV no admite pestañas. Elige Pendientes o Pagadas.' : undefined}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors hover:bg-bone disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <FileText size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              <span className="truncate">Descargar CSV</span>
            </button>

            <div className="my-1 h-px bg-border/60" />

            <button
              type="button"
              onClick={handleDrive}
              disabled={driveState === 'saving'}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left transition-colors hover:bg-bone disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {driveState === 'saving' ? (
                <Loader2 size={15} strokeWidth={1.5} className="text-mid-gray shrink-0 animate-spin" />
              ) : (
                <UploadCloud size={15} strokeWidth={1.5} className="text-mid-gray shrink-0" />
              )}
              <span className="truncate">
                Actualizar hoja de {currentMonthLabel} {currentYear} en Drive
              </span>
            </button>
          </div>

          {driveState === 'done' && driveLink && (
            <a
              href={driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-positive-bg text-positive-text text-caption transition-colors hover:opacity-90"
            >
              <Check size={13} strokeWidth={2} className="shrink-0" />
              <span className="truncate">Hoja guardada en Drive — abrir</span>
              <ExternalLink size={13} strokeWidth={1.5} className="shrink-0 ml-auto" />
            </a>
          )}

          {driveState === 'error' && driveError && (
            <div className="mt-2 flex items-start gap-1.5 px-3 py-2 rounded-lg bg-negative-bg text-negative-text text-caption">
              <AlertCircle size={13} strokeWidth={2} className="shrink-0 mt-0.5" />
              <span>{driveError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
