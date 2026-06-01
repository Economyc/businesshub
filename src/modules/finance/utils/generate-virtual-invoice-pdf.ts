// Genera un PDF "virtual" para facturas que no tienen archivo físico.
// El PDF lleva un watermark claro de FACTURA VIRTUAL para que nadie
// la confunda con una factura real. Se sube a Drive con el mismo
// callable que las facturas escaneadas (uploadDocumentToDrive).

import { formatCurrency } from '@/core/utils/format'

const loadJsPDF = () => import('jspdf').then((m) => m.default)

export interface VirtualInvoiceData {
  companyName: string
  supplierName: string
  docNumber: string
  date: string // YYYY-MM-DD
  amount: number
  category: string
  notes?: string
  docType?: 'Factura' | 'Compra' // default 'Factura'
}

function formatDateLong(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Devuelve el PDF como base64 (sin el prefijo data:) listo para el callable.
export async function generateVirtualInvoicePDF(data: VirtualInvoiceData): Promise<string> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })

  const docType = data.docType ?? 'Factura'
  const label = docType.toUpperCase()

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 18

  // Watermark diagonal "<TIPO> VIRTUAL" — semi-transparente, gris claro.
  doc.saveGraphicsState()
  // @ts-expect-error setGState typings incompletos
  doc.setGState(new doc.GState({ opacity: 0.08 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(80)
  doc.setTextColor(120, 120, 120)
  doc.text(`${label} VIRTUAL`, pageW / 2, pageH / 2, {
    align: 'center',
    angle: 35,
  })
  doc.restoreGraphicsState()

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(40, 40, 40)
  doc.text(`${label} VIRTUAL`, margin, margin + 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('Documento generado por BusinessHub para reemplazar el documento sin archivo físico.', margin, margin + 11)
  doc.text(`Empresa: ${data.companyName}`, margin, margin + 16)

  // Línea divisora
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, margin + 22, pageW - margin, margin + 22)

  // Bloque de datos (2 columnas)
  let y = margin + 32
  const colX = pageW / 2 + 4
  const labelColor: [number, number, number] = [130, 130, 130]
  const valueColor: [number, number, number] = [40, 40, 40]

  function field(label: string, value: string, x: number, yPos: number) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...labelColor)
    doc.text(label.toUpperCase(), x, yPos)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...valueColor)
    doc.text(value || '—', x, yPos + 5)
  }

  field('Proveedor', data.supplierName, margin, y)
  field(`Número de ${docType.toLowerCase()}`, data.docNumber, colX, y)
  y += 16

  field('Fecha', formatDateLong(data.date), margin, y)
  field('Categoría', data.category, colX, y)
  y += 16

  // Valor — destacado
  doc.setDrawColor(220, 220, 220)
  doc.line(margin, y - 2, pageW - margin, y - 2)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...labelColor)
  doc.text('VALOR TOTAL', margin, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(40, 40, 40)
  doc.text(formatCurrency(data.amount, 0), margin, y + 10)
  y += 22

  // Notas
  if (data.notes && data.notes.trim()) {
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y - 2, pageW - margin, y - 2)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...labelColor)
    doc.text('NOTAS', margin, y)
    y += 5

    doc.setFontSize(10)
    doc.setTextColor(...valueColor)
    const lines = doc.splitTextToSize(data.notes.trim(), pageW - margin * 2)
    doc.text(lines, margin, y + 4)
  }

  // Footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text(
    docType === 'Compra'
      ? `Generado el ${new Date().toLocaleString('es-CO')} — placeholder generado por BusinessHub`
      : `Generado el ${new Date().toLocaleString('es-CO')} — placeholder hasta cruzar con comprobante de pago`,
    margin,
    pageH - margin,
  )

  // Output como base64 sin el prefijo data:
  const dataUri = doc.output('datauristring')
  return dataUri.split(',')[1] ?? ''
}
