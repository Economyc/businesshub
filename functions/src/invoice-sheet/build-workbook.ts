// Generación del .xlsx en Node con estilos, usando exceljs (el paquete `xlsx`
// libre NO escribe estilos de celda). Devuelve base64 directo para
// uploadOrReplaceFile. La conversión .xlsx → Google Sheet en Drive preserva
// negrilla, relleno, bordes, fila congelada, filtros y formato de número.
//
// Layout de cada pestaña:
//   Fila 1: aviso (combinada a lo ancho, ámbar) — la hoja se regenera sola.
//   Fila 2: encabezados (negrilla, fondo grafito, texto blanco) — congelada.
//   Fila 3+: datos con bordes finos (look de tabla real) + filtros.

import ExcelJS from 'exceljs'
import type { FieldDef } from './accounting-rows.js'

export interface SheetSpec {
  name: string
  data: Record<string, unknown>[]
  fields: FieldDef[]
}

// Aviso para la contadora: la hoja es un reporte automático.
export const SHEET_WARNING =
  '⚠ Hoja generada automáticamente desde BusinessHub — no editar a mano (se regenera sola y los cambios se pierden).'

const HEADER_FILL = 'FF374151' // grafito
const HEADER_TEXT = 'FFFFFFFF' // blanco
const WARNING_FILL = 'FFFFF8E1' // ámbar muy claro
const WARNING_TEXT = 'FF9A6700' // ámbar oscuro
const GRID = 'FFE5E7EB' // gris claro para bordes

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: GRID } },
  left: { style: 'thin', color: { argb: GRID } },
  bottom: { style: 'thin', color: { argb: GRID } },
  right: { style: 'thin', color: { argb: GRID } },
}

// Valor de celda: número crudo cuando el campo es numérico (para que Sheets lo
// sume y reciba formato de número), si no string. null deja la celda vacía.
function cellValue(item: Record<string, unknown>, f: FieldDef): string | number | null {
  const val = item[f.key]
  if (f.type === 'number') {
    const n = typeof val === 'number' ? val : Number(val)
    return Number.isFinite(n) ? n : null
  }
  return String(val ?? '')
}

export async function buildWorkbookBase64(sheets: SheetSpec[]): Promise<string> {
  const wb = new ExcelJS.Workbook()

  for (const s of sheets) {
    const ncols = s.fields.length
    // Excel limita nombres de pestaña a 31 chars y prohíbe : \ / ? * [ ]
    const safeName = s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Datos'
    // Congelar las 2 primeras filas (aviso + encabezados).
    const ws = wb.addWorksheet(safeName, { views: [{ state: 'frozen', ySplit: 2 }] })

    // Fila 1 — aviso combinado a lo ancho.
    ws.addRow([SHEET_WARNING])
    if (ncols > 1) ws.mergeCells(1, 1, 1, ncols)
    const warn = ws.getCell(1, 1)
    warn.font = { italic: true, size: 10, color: { argb: WARNING_TEXT } }
    warn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARNING_FILL } }
    warn.alignment = { vertical: 'middle' }

    // Fila 2 — encabezados.
    const headerRow = ws.addRow(s.fields.map((f) => f.header))
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: HEADER_TEXT } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.alignment = { vertical: 'middle' }
      cell.border = thinBorder
    })

    // Filas de datos.
    for (const item of s.data) {
      const row = ws.addRow(s.fields.map((f) => cellValue(item, f)))
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder
      })
    }

    // Anchos + formato de número en la columna Valor.
    s.fields.forEach((f, i) => {
      const col = ws.getColumn(i + 1)
      col.width = Math.max(f.header.length + 2, 14)
      if (f.type === 'number') col.numFmt = '#,##0'
    })

    // Filtros sobre el rango de la tabla (look de tabla real).
    const lastRow = 2 + s.data.length
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastRow, column: ncols } }
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf as ArrayBuffer).toString('base64')
}
