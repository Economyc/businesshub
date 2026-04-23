import Papa from 'papaparse'
import { saveAs } from 'file-saver'

// `xlsx` pesa ~300KB gzip — lo cargamos dinámicamente al primer uso para
// sacarlo del bundle inicial. Los dashboards no lo necesitan hasta que el
// usuario exporte/importe.
const loadXLSX = () => import('xlsx')

// ─── Field Schema ───

export interface FieldDef {
  key: string
  header: string
  required?: boolean
  type: 'string' | 'number' | 'date' | 'enum'
  enumValues?: string[]
  format?: (value: unknown) => string
  parse?: (raw: string) => unknown
}

export interface RowError {
  row: number
  field: string
  message: string
}

export interface ValidationResult<T> {
  valid: T[]
  errors: RowError[]
}

// ─── Export ───

export async function exportToExcel<T>(data: T[], fields: FieldDef[], filename: string) {
  const XLSX = await loadXLSX()
  const headers = fields.map((f) => f.header)
  const rows = data.map((item) =>
    fields.map((f) => {
      const val = (item as Record<string, unknown>)[f.key]
      return f.format ? f.format(val) : String(val ?? '')
    }),
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Auto-size columns
  ws['!cols'] = fields.map((f) => ({ wch: Math.max(f.header.length + 2, 14) }))

  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}.xlsx`)
}

export function exportToCSV<T>(data: T[], fields: FieldDef[], filename: string) {
  const rows = data.map((item) => {
    const row: Record<string, string> = {}
    for (const f of fields) {
      const val = (item as Record<string, unknown>)[f.key]
      row[f.header] = f.format ? f.format(val) : String(val ?? '')
    }
    return row
  })

  const csv = Papa.unparse(rows, { columns: fields.map((f) => f.header) })
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${filename}.csv`)
}

export async function downloadTemplate(fields: FieldDef[], filename: string) {
  const XLSX = await loadXLSX()
  const headers = fields.map((f) => f.header)
  const example = fields.map((f) => {
    if (f.enumValues) return f.enumValues[0]
    if (f.type === 'number') return '0'
    if (f.type === 'date') return '2026-01-15'
    return ''
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = fields.map((f) => ({ wch: Math.max(f.header.length + 2, 14) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `plantilla_${filename}.xlsx`)
}

// ─── Import ───

export async function parseFile(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv' || ext === 'txt') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(new Error(err.message)),
      })
    })
  }

  // Excel
  const XLSX = await loadXLSX()
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false })
}

export function normalizeHeaders(
  rawHeaders: string[],
  fields: FieldDef[],
): Map<string, string> {
  const mapping = new Map<string, string>()

  for (const field of fields) {
    const target = field.header.toLowerCase().trim()
    const match = rawHeaders.find(
      (h) => h.toLowerCase().trim() === target || h.toLowerCase().trim() === field.key.toLowerCase(),
    )
    if (match) {
      mapping.set(field.key, match)
    }
  }

  return mapping
}

export function validateRows<T>(
  records: Record<string, string>[],
  fields: FieldDef[],
): ValidationResult<T> {
  const valid: T[] = []
  const errors: RowError[] = []

  // Build header mapping from first record
  const rawHeaders = records.length > 0 ? Object.keys(records[0]) : []
  const headerMap = normalizeHeaders(rawHeaders, fields)

  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const row = i + 2 // +2 because row 1 is headers, data starts at 2
    const parsed: Record<string, unknown> = {}
    let rowValid = true

    for (const field of fields) {
      const rawKey = headerMap.get(field.key)
      const rawValue = rawKey ? (record[rawKey] ?? '').trim() : ''

      if (field.required && !rawValue) {
        errors.push({ row, field: field.header, message: `"${field.header}" es requerido` })
        rowValid = false
        continue
      }

      if (!rawValue && !field.required) {
        parsed[field.key] = field.type === 'number' ? undefined : ''
        continue
      }

      if (field.parse) {
        try {
          parsed[field.key] = field.parse(rawValue)
        } catch {
          errors.push({ row, field: field.header, message: `"${field.header}": valor invalido "${rawValue}"` })
          rowValid = false
        }
        continue
      }

      switch (field.type) {
        case 'number': {
          const num = Number(rawValue.replace(/[,$\s]/g, ''))
          if (isNaN(num)) {
            errors.push({ row, field: field.header, message: `"${field.header}" debe ser un numero` })
            rowValid = false
          } else {
            parsed[field.key] = num
          }
          break
        }
        case 'date': {
          const date = new Date(rawValue)
          if (isNaN(date.getTime())) {
            errors.push({ row, field: field.header, message: `"${field.header}" debe ser una fecha valida (YYYY-MM-DD)` })
            rowValid = false
          } else {
            parsed[field.key] = date
          }
          break
        }
        case 'enum': {
          if (field.enumValues && !field.enumValues.includes(rawValue.toLowerCase())) {
            errors.push({
              row,
              field: field.header,
              message: `"${field.header}" debe ser: ${field.enumValues.join(', ')}`,
            })
            rowValid = false
          } else {
            parsed[field.key] = rawValue.toLowerCase()
          }
          break
        }
        default:
          parsed[field.key] = rawValue
      }
    }

    if (rowValid) {
      valid.push(parsed as T)
    }
  }

  return { valid, errors }
}
