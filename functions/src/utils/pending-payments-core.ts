// Núcleo compartido del reporte de pagos pendientes por compañía: construye las
// secciones (facturas por proveedor + otras obligaciones) y el caption. Lo usan
// el cron notifyPendingPayments y el botón/comando on-demand del bot de Telegram.

import { db } from '../firestore.js'
import { fmtMoney } from './format-money.js'
import {
  type PendingReport,
  type PendingCompany,
  type PendingInvoiceSupplier,
  type PendingObligation,
} from './build-pending-payments-pdf.js'

export const PENDING_STATUSES = ['pending', 'overdue', 'partial']

interface TxData {
  type?: string
  status?: string
  documentKind?: string
  amount?: number
  paidAmount?: number
  remainingAmount?: number
  concept?: string
  date?: unknown
  dueDate?: unknown
  priority?: string
  payeeRef?: { name?: string } | null
  interLocalGroupId?: string
  splitGroupId?: string
}

/**
 * Lo que falta por pagar. Antes se reportaba `amount`, con lo que una factura
 * parcial figuraba por su valor total aunque ya estuviera medio abonada.
 * Prioriza el denormalizado y cae a amount − paidAmount si falta.
 */
function pendingAmount(t: TxData): number {
  const amount = Number(t.amount) || 0
  if (typeof t.remainingAmount === 'number') return Math.max(0, t.remainingAmount)
  return Math.max(0, amount - (Number(t.paidAmount) || 0))
}

/** Parte de un gasto compartido entre locales (ver Ecore split-service.ts). */
function isSharedExpense(t: TxData): boolean {
  const id = t.splitGroupId
  return !!id && (id.startsWith('split-') || id.startsWith('rsplit-'))
}

/** Acepta Timestamp de Admin (toDate), serializado (_seconds) o Date. */
function tsToDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'object' && val !== null) {
    const o = val as { toDate?: () => Date; _seconds?: number; seconds?: number }
    if (typeof o.toDate === 'function') return o.toDate()
    if (typeof o._seconds === 'number') return new Date(o._seconds * 1000)
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000)
  }
  return null
}

function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().split('T')[0] : null
}

export function bogotaLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(date)
}

/** Construye la sección de una compañía. Devuelve null si no tiene nada pendiente. */
export async function buildCompanySection(
  companyId: string,
  companyName: string,
): Promise<PendingCompany | null> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection('transactions')
    .where('status', 'in', PENDING_STATUSES)
    .get()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Bloque A — facturas por pagar agrupadas por proveedor.
  const groups = new Map<string, PendingInvoiceSupplier & { oldest: Date | null; shared: number }>()
  let invoiceTotal = 0
  let invoiceCount = 0

  // Bloque B — otras obligaciones (gasto pendiente que NO es factura).
  const obligations: PendingObligation[] = []
  let obligationTotal = 0

  for (const doc of snap.docs) {
    const t = doc.data() as TxData
    // Lo que falta por pagar, no el valor de la factura: una parcial ya abonada
    // inflaba el reporte por su total.
    const amount = pendingAmount(t)

    if (t.documentKind === 'invoice') {
      const name = t.payeeRef?.name ?? 'Sin proveedor'
      const key = name.toLowerCase().trim()
      const entry =
        groups.get(key) ??
        ({ supplierName: name, count: 0, total: 0, oldestDate: null, overdueCount: 0, oldest: null, shared: 0 } as PendingInvoiceSupplier & {
          oldest: Date | null
          shared: number
        })
      entry.count += 1
      entry.total += amount
      if (isSharedExpense(t)) entry.shared += 1
      const d = tsToDate(t.date)
      if (d && (!entry.oldest || d < entry.oldest)) entry.oldest = d
      if (t.status === 'overdue' || (d && d < today)) entry.overdueCount += 1
      groups.set(key, entry)
      invoiceTotal += amount
      invoiceCount += 1
    } else if (t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')) {
      obligations.push({
        concept: String(t.concept ?? ''),
        dueDate: isoDate(tsToDate(t.dueDate) ?? tsToDate(t.date)),
        amount,
        status: String(t.status ?? 'pending'),
      })
      obligationTotal += amount
    }
  }

  if (invoiceCount === 0 && obligations.length === 0) return null

  const invoiceSuppliers: PendingInvoiceSupplier[] = Array.from(groups.values())
    .map((g) => ({
      // El monto de una factura compartida es sólo la parte de ESTA compañía;
      // el mismo proveedor aparece también en la sección del otro local. Sin la
      // marca parece que la factura vale menos de lo que dice el documento.
      supplierName:
        g.shared === 0
          ? g.supplierName
          : g.shared === g.count
            ? `${g.supplierName} (compartida)`
            : `${g.supplierName} (incl. compartidas)`,
      count: g.count,
      total: g.total,
      oldestDate: isoDate(g.oldest),
      overdueCount: g.overdueCount,
    }))
    .sort((a, b) => b.total - a.total)

  obligations.sort((a, b) => b.amount - a.amount)

  return {
    companyName,
    invoiceSuppliers,
    invoiceTotal,
    invoiceCount,
    obligations,
    obligationTotal,
    obligationCount: obligations.length,
    companyTotal: invoiceTotal + obligationTotal,
  }
}

export function buildCaption(report: PendingReport): string {
  const lines = [
    `💸 <b>Pagos pendientes</b> — ${report.dateLabel}`,
    `Total por pagar: <b>${fmtMoney(report.grandTotal)}</b>`,
    '',
    ...report.companies.map((c) => `• ${c.companyName}: ${fmtMoney(c.companyTotal)}`),
    '',
    'Detalle completo en el PDF adjunto.',
  ]
  return lines.join('\n')
}
