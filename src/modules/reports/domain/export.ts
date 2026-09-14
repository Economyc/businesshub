import {
  exportSheetsToExcel,
  exportToCSV,
  type CsvOptions,
  type FieldDef,
  type SheetSpec,
} from '@/core/utils/data-transfer'
import type { CellValue, ReportColumn, ReportTableData } from './builders'
import { periodSlug, type ReportPeriod } from './period'

// Excel en configuración regional es-CO separa columnas con ';' y usa coma
// decimal: un CSV con ',' se abre todo en una sola columna.
export const REPORT_CSV_OPTIONS: CsvOptions = { delimiter: ';', decimalComma: true }

export interface ExportableSheet {
  label: string
  table: ReportTableData
}

const NUMERIC_TYPES = new Set<ReportColumn['type']>(['integer', 'currency', 'percent', 'variation'])

function fileValue(col: ReportColumn, value: CellValue | undefined): CellValue {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number') return value
  if (col.type === 'integer' || col.type === 'currency') return Math.round(value)
  if (col.type === 'percent' || col.type === 'variation') return Math.round(value * 10) / 10
  return value
}

export function toFieldDefs(table: ReportTableData): FieldDef[] {
  return table.columns.map((c) => ({
    key: c.key,
    header: c.header,
    type: NUMERIC_TYPES.has(c.type) ? 'number' : 'string',
    blankNull: true,
  }))
}

/** Filas listas para archivo: pesos y conteos enteros, porcentajes con 1 decimal, vacíos en blanco. */
export function toFileRows(table: ReportTableData): Record<string, CellValue>[] {
  return table.rows.map((row) =>
    Object.fromEntries(table.columns.map((c) => [c.key, fileValue(c, row.values[c.key])])),
  )
}

export function toSheetSpecs(sheets: ExportableSheet[]): SheetSpec[] {
  return sheets.map((s) => ({ name: s.label, data: toFileRows(s.table), fields: toFieldDefs(s.table) }))
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "Blue Smash Brgr · Escondite", para títulos en pantalla. */
export function companyDisplayName(company: { name?: string; location?: string | null } | null | undefined): string {
  return [company?.name, company?.location].filter(Boolean).join(' · ')
}

/** "Blue Smash Brgr" + "Escondite" → "Blue-Escondite". */
export function companyFileLabel(company: { name?: string; location?: string | null } | null | undefined): string {
  const brand = company?.name?.trim().split(/\s+/)[0] ?? ''
  return slugify([brand, company?.location ?? ''].filter(Boolean).join(' ')) || 'Compania'
}

/** "Blue-Escondite_ventas-por-canal_2026-08" (con la hoja si es un CSV). */
export function reportFileName(companyLabel: string, reportId: string, period: ReportPeriod, sheetId?: string): string {
  return [companyLabel, reportId, sheetId, periodSlug(period)].filter(Boolean).join('_')
}

export function downloadReportExcel(sheets: ExportableSheet[], filename: string): Promise<void> {
  return exportSheetsToExcel(toSheetSpecs(sheets), filename)
}

export function downloadReportCsv(sheet: ExportableSheet, filename: string): Promise<void> {
  return exportToCSV(toFileRows(sheet.table), toFieldDefs(sheet.table), filename, REPORT_CSV_OPTIONS)
}
