import type { PayrollItem, PayrollRecord } from '../types'
import { MONTH_NAMES, OVERTIME_LABELS } from '../types'

function fmt(n: number): string {
  return `$${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export async function exportPayrollSlip(
  item: PayrollItem,
  payroll: Pick<PayrollRecord, 'year' | 'month' | 'periodLabel'>,
  companyName: string,
) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'letter' })

  const pageW = pdf.internal.pageSize.getWidth()
  const marginX = 20
  const contentW = pageW - marginX * 2
  let y = 25

  // ─── Header ───
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(companyName.toUpperCase(), pageW / 2, y, { align: 'center' })
  y += 7

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('COMPROBANTE DE PAGO DE NOMINA', pageW / 2, y, { align: 'center' })
  y += 6

  pdf.setFontSize(9)
  pdf.text(`Periodo: ${MONTH_NAMES[payroll.month]} ${payroll.year}`, pageW / 2, y, { align: 'center' })
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

  // ─── Devengados ───
  pdf.setDrawColor(200, 200, 200)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('DEVENGADOS', marginX, y)
  pdf.text('VALOR', pageW - marginX, y, { align: 'right' })
  y += 6

  const earnings: [string, number][] = [
    ['Salario Basico', item.baseSalary],
  ]

  if (item.auxilioTransporte > 0) {
    earnings.push(['Auxilio de Transporte', item.auxilioTransporte])
  }

  for (const entry of item.overtime) {
    if (entry.hours > 0) {
      earnings.push([`${OVERTIME_LABELS[entry.type]} (${entry.hours}h)`, Math.round(item.baseSalary / 240 * entry.hours * (entry.type === 'diurna' ? 1.25 : entry.type === 'nocturna' ? 1.75 : entry.type === 'dominical_diurna' ? 2.0 : 2.5))])
    }
  }

  pdf.setFont('helvetica', 'normal')
  for (const [label, value] of earnings) {
    pdf.text(label, marginX + 4, y)
    pdf.text(fmt(value), pageW - marginX, y, { align: 'right' })
    y += 5
  }

  y += 2
  pdf.setFont('helvetica', 'bold')
  pdf.text('Total Devengados', marginX + 4, y)
  pdf.text(fmt(item.totalEarnings), pageW - marginX, y, { align: 'right' })
  y += 8

  // ─── Deducciones ───
  pdf.setDrawColor(200, 200, 200)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 6

  pdf.setFont('helvetica', 'bold')
  pdf.text('DEDUCCIONES', marginX, y)
  pdf.text('VALOR', pageW - marginX, y, { align: 'right' })
  y += 6

  const deductions: [string, number][] = [
    ['Salud (4%)', item.healthDeduction],
    ['Pension (4%)', item.pensionDeduction],
  ]

  for (const ded of item.additionalDeductions) {
    deductions.push([ded.concept, ded.amount])
  }

  pdf.setFont('helvetica', 'normal')
  for (const [label, value] of deductions) {
    pdf.text(label, marginX + 4, y)
    pdf.text(fmt(value), pageW - marginX, y, { align: 'right' })
    y += 5
  }

  y += 2
  pdf.setFont('helvetica', 'bold')
  pdf.text('Total Deducciones', marginX + 4, y)
  pdf.text(fmt(item.totalDeductions), pageW - marginX, y, { align: 'right' })
  y += 10

  // ─── Neto ───
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.5)
  pdf.line(marginX, y, pageW - marginX, y)
  y += 7

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('NETO A PAGAR', marginX, y)
  pdf.text(fmt(item.netPay), pageW - marginX, y, { align: 'right' })
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

  // ─── Page number ───
  pdf.setFontSize(7)
  pdf.setTextColor(160, 160, 160)
  pdf.text(
    `Generado el ${new Date().toLocaleDateString('es-CO')}`,
    pageW / 2,
    pdf.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  )

  const safeName = item.employeeName.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`Nomina_${safeName}_${MONTH_NAMES[payroll.month]}_${payroll.year}.pdf`)
}
