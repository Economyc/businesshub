// Genera el PDF del reporte de conteo con pdf-lib (dibujo manual de tablas, ya que
// build-combined-pdf.ts solo COMBINA documentos). Dos bloques: (A) inventario contado
// completo y (B) solo las diferencias. Encabezado con empresa/fecha/aprobado y recuadro
// resumen. Pagina solo (Blue tiene ~61 insumos). Devuelve un Buffer.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { fmtMoney, fmtQty } from './format-money.js'
import type { CountReportData, CountAllLine, CountDiffLine } from './count-report-types.js'

const PAGE = { w: 595.28, h: 841.89 } // A4 vertical
const MARGIN = 40
const CONTENT_W = PAGE.w - MARGIN * 2
const ROW_H = 16
const PAD = 5

const GRAPHITE = rgb(0.16, 0.18, 0.2)
const MID = rgb(0.45, 0.47, 0.5)
const LINE = rgb(0.9, 0.9, 0.92)
const HEADER_FILL = rgb(0.22, 0.25, 0.28)
const NEGATIVE = rgb(0.7, 0.18, 0.18)
const WARNING = rgb(0.72, 0.45, 0.05)
const WHITE = rgb(1, 1, 1)

interface Col {
  header: string
  width: number
  align: 'left' | 'right'
}

// Inventario completo y diferencias comparten el mismo layout de columnas.
const COLS: Col[] = [
  { header: 'Insumo', width: 150, align: 'left' },
  { header: 'Categoría', width: 80, align: 'left' },
  { header: 'Unidad', width: 45, align: 'left' },
  { header: 'Esperado', width: 55, align: 'right' },
  { header: 'Contado', width: 55, align: 'right' },
  { header: 'Diferencia', width: 55, align: 'right' },
  { header: 'Valor', width: 75, align: 'right' },
]

interface Doc {
  pdf: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

function clip(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1)
  return `${t}…`
}

function addPage(d: Doc): void {
  d.page = d.pdf.addPage([PAGE.w, PAGE.h])
  d.y = PAGE.h - MARGIN
}

function ensureSpace(d: Doc, needed: number): void {
  if (d.y - needed < MARGIN) addPage(d)
}

function drawTableHeader(d: Doc): void {
  ensureSpace(d, ROW_H)
  d.page.drawRectangle({ x: MARGIN, y: d.y - ROW_H, width: CONTENT_W, height: ROW_H, color: HEADER_FILL })
  let x = MARGIN
  for (const c of COLS) {
    const w = d.bold.widthOfTextAtSize(c.header, 8)
    const tx = c.align === 'right' ? x + c.width - PAD - w : x + PAD
    d.page.drawText(c.header, { x: tx, y: d.y - ROW_H + 5, size: 8, font: d.bold, color: WHITE })
    x += c.width
  }
  d.y -= ROW_H
}

function drawRow(d: Doc, cells: string[], color = GRAPHITE): void {
  // Si no cabe la fila, nueva página + re-dibuja el encabezado de columnas.
  if (d.y - ROW_H < MARGIN) {
    addPage(d)
    drawTableHeader(d)
  }
  let x = MARGIN
  COLS.forEach((c, i) => {
    const raw = cells[i] ?? ''
    const text = clip(raw, d.font, 8, c.width - PAD * 2)
    const w = d.font.widthOfTextAtSize(text, 8)
    const tx = c.align === 'right' ? x + c.width - PAD - w : x + PAD
    d.page.drawText(text, { x: tx, y: d.y - ROW_H + 5, size: 8, font: d.font, color })
    x += c.width
  })
  d.page.drawLine({
    start: { x: MARGIN, y: d.y - ROW_H },
    end: { x: MARGIN + CONTENT_W, y: d.y - ROW_H },
    thickness: 0.5,
    color: LINE,
  })
  d.y -= ROW_H
}

function sectionTitle(d: Doc, title: string): void {
  ensureSpace(d, ROW_H + 8)
  d.y -= 8
  d.page.drawText(title, { x: MARGIN, y: d.y - 11, size: 11, font: d.bold, color: GRAPHITE })
  d.y -= ROW_H
}

function diffColor(diff: number): ReturnType<typeof rgb> {
  if (diff < 0) return NEGATIVE
  if (diff > 0) return WARNING
  return GRAPHITE
}

function allLineCells(l: CountAllLine): string[] {
  const sign = l.diff > 0 ? '+' : ''
  return [
    l.name,
    l.category || '—',
    l.unit,
    fmtQty(l.expected),
    fmtQty(l.counted),
    `${sign}${fmtQty(l.diff)}`,
    l.diffValue != null ? `${sign}${fmtMoney(l.diffValue)}` : '—',
  ]
}

function diffLineCells(l: CountDiffLine): string[] {
  const sign = l.diff > 0 ? '+' : ''
  return [
    l.name,
    '—',
    l.unit,
    fmtQty(l.expected),
    fmtQty(l.counted),
    `${sign}${fmtQty(l.diff)}`,
    l.diffValue != null ? `${sign}${fmtMoney(l.diffValue)}` : '—',
  ]
}

export async function buildCountDiffPdf(data: CountReportData): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const d: Doc = { pdf, page: pdf.addPage([PAGE.w, PAGE.h]), y: PAGE.h - MARGIN, font, bold }

  // Encabezado del documento.
  const title = data.companyName ? `Conteo de inventario — ${data.companyName}` : 'Conteo de inventario'
  d.page.drawText(clip(title, bold, 16, CONTENT_W), { x: MARGIN, y: d.y - 16, size: 16, font: bold, color: GRAPHITE })
  d.y -= 16 + 6
  d.page.drawText(`Fecha: ${data.countDate}   ·   Aprobado por: ${data.approvedBy || '—'}`, {
    x: MARGIN,
    y: d.y - 10,
    size: 9,
    font,
    color: MID,
  })
  d.y -= 10 + 14

  // Recuadro resumen.
  const { totals } = data
  const boxH = 48
  d.page.drawRectangle({
    x: MARGIN,
    y: d.y - boxH,
    width: CONTENT_W,
    height: boxH,
    borderColor: LINE,
    borderWidth: 1,
  })
  const cellW = CONTENT_W / 4
  const summary: Array<{ label: string; value: string; color: ReturnType<typeof rgb> }> = [
    { label: 'FALTANTE', value: fmtMoney(totals.shortageValue), color: NEGATIVE },
    { label: 'SOBRANTE', value: fmtMoney(totals.overageValue), color: WARNING },
    { label: 'NETO', value: fmtMoney(totals.netValue), color: GRAPHITE },
    {
      label: 'INSUMOS C/ DIFERENCIA',
      value: String(totals.itemsWithDiff),
      color: GRAPHITE,
    },
  ]
  summary.forEach((s, i) => {
    const cx = MARGIN + cellW * i + 10
    d.page.drawText(s.label, { x: cx, y: d.y - 16, size: 7, font: bold, color: MID })
    d.page.drawText(s.value, { x: cx, y: d.y - 34, size: 13, font: bold, color: s.color })
  })
  d.y -= boxH + 6

  // Bloque A — Inventario contado completo.
  const all = data.allLines ?? []
  sectionTitle(d, `Inventario contado (${all.length} ${all.length === 1 ? 'insumo' : 'insumos'})`)
  if (all.length === 0) {
    d.page.drawText('Sin datos de inventario completo.', { x: MARGIN, y: d.y - 11, size: 9, font, color: MID })
    d.y -= ROW_H
  } else {
    drawTableHeader(d)
    for (const l of all) drawRow(d, allLineCells(l), diffColor(l.diff))
  }

  // Bloque B — Solo diferencias.
  sectionTitle(d, `Diferencias (${data.lines.length})`)
  if (data.lines.length === 0) {
    d.page.drawText('Sin diferencias respecto al stock esperado.', { x: MARGIN, y: d.y - 11, size: 9, font, color: MID })
    d.y -= ROW_H
  } else {
    drawTableHeader(d)
    for (const l of data.lines) drawRow(d, diffLineCells(l), diffColor(l.diff))
  }

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}
