import { useCallback, useRef, useState } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import type { ReportContext } from '../domain/builders'
import { companyFileLabel, downloadReportCsv, downloadReportExcel, reportFileName } from '../domain/export'
import type { ReportDefinition, ReportSheet } from '../registry'

/** Descarga de informes en Excel (todas las hojas) o CSV (una hoja). */
export function useReportDownloads(context: ReportContext) {
  const { selectedCompany } = useCompany()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // xlsx y papaparse se cargan al primer clic; el ref ignora clics repetidos mientras tanto.
  const busyRef = useRef(false)

  const run = useCallback(async (key: string, task: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(key)
    setError(null)
    try {
      await task()
    } catch (err) {
      console.error('[reports] descarga fallida', err)
      setError('No se pudo generar el archivo. Intenta de nuevo.')
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }, [])

  const downloadExcel = useCallback(
    (report: ReportDefinition) =>
      run(`${report.id}:xlsx`, () =>
        downloadReportExcel(
          report.sheets.map((s) => ({ label: s.label, table: s.build(context) })),
          reportFileName(companyFileLabel(selectedCompany), report.id, context.period),
        ),
      ),
    [run, context, selectedCompany],
  )

  const downloadCsv = useCallback(
    (report: ReportDefinition, sheet: ReportSheet = report.sheets[0]) =>
      run(`${report.id}:csv`, () =>
        downloadReportCsv(
          { label: sheet.label, table: sheet.build(context) },
          reportFileName(
            companyFileLabel(selectedCompany),
            report.id,
            context.period,
            report.sheets.length > 1 ? sheet.id : undefined,
          ),
        ),
      ),
    [run, context, selectedCompany],
  )

  return { busy, error, downloadExcel, downloadCsv }
}
