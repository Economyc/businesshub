import type { SettlementItem, SettlementRecord } from '../types'

function fmt(n: number): string {
  return `$${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export async function exportSettlementSlip(
  item: SettlementItem,
  settlement: Pick<SettlementRecord, 'year' | 'periodLabel' | 'typeLabel'>,
  companyName: string,
) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })

  const pageW = pdf.internal.pageSize.getWidth()
  const marginX = 20
  let y = 25

  // ─── Header ───
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(companyName.toUpperCase(), pageW / 2, y, { align: 'center' })
  y += 7

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('LIQUIDACION DE PRESTACIONES SOCIALES', pageW / 2, y, { align: 'center' })
  y += 6

  pdf.setFontSize(9)
  pdf.text(`${settlement.typeLabel} — ${settlement.year}`, pageW / 2, y, { align: 'center' })
  y += 10

  // ─── Separator ───
  pdf.setDrawColor(200, 200, 200)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 8

  // ─── Employee Info ───
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DATOS DEL EMPLEADO', marginX, y)
  y += 6

  const info = [
    ['Nombre:', item.employeeName],
    ['Identificacion:', item.employeeIdentification || '—'],
    ['Cargo:', item.employeeRole],
    ['Departamento:', item.employeeDepartment],
    ['Salario:', fmt(item.salary)],
  ]

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  for (const [label, value] of info) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, marginX, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(value, marginX + 35, y)
    y += 5
  }
  y += 6

  // ─── Conceptos ───
  pdf.setDrawColor(200, 200, 200)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('CONCEPTO', marginX, y)
  pdf.text('PERIODO', marginX + 55, y)
  pdf.text('DIAS', marginX + 100, y)
  pdf.text('VALOR', pageW - marginX, y, { align: 'right' })
  y += 6

  pdf.setFont('helvetica', 'normal')
  for (const concept of item.concepts) {
    pdf.text(concept.label, marginX + 2, y)
    pdf.text(`${concept.periodStart} a ${concept.periodEnd}`, marginX + 55, y)
    pdf.text(String(concept.daysWorked), marginX + 100, y)
    pdf.text(fmt(concept.amount), pageW - marginX, y, { align: 'right' })
    y += 5

    // Formula
    pdf.setFontSize(7)
    pdf.setTextColor(130, 130, 130)
    pdf.text(concept.formula, marginX + 4, y)
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(9)
    y += 5
  }

  y += 4

  // ─── Total ───
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.5)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 7

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TOTAL A PAGAR', marginX, y)
  pdf.text(fmt(item.totalAmount), pageW - marginX, y, { align: 'right' })
  y += 20

  // ─── Firmas ───
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setDrawColor(180, 180, 180)

  const leftX = marginX + 10
  const rightX = pageW / 2 + 20
  const sigW = 55

  pdf.line(leftX, y, leftX + sigW, y)
  pdf.line(rightX, y, rightX + sigW, y)
  y += 4

  pdf.text('Firma Empleador', leftX + sigW / 2, y, { align: 'center' })
  pdf.text('Firma Empleado', rightX + sigW / 2, y, { align: 'center' })

  // ─── Footer ───
  pdf.setFontSize(7)
  pdf.setTextColor(160, 160, 160)
  pdf.text(
    `Generado el ${new Date().toLocaleDateString('es-CO')}`,
    pageW / 2,
    pdf.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  )

  const safeName = item.employeeName.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`Prestaciones_${safeName}_${settlement.typeLabel.replace(/\s+/g, '_')}_${settlement.year}.pdf`)
}
