// Port server-side de la hoja de seguimiento de facturas/pagos.
//
// Replica fiel de `src/modules/finance/utils/accounting-export.ts` y de
// `parseCategory` de `src/core/utils/categories.ts`. No se puede importar `src/`
// desde `functions/` (paquetes TS separados, alias `@/` propio del front), por
// eso se copia. Si cambian las columnas o la lógica en el cliente, actualizar
// ambos lados. Las fechas aquí son `Timestamp` de firebase-admin (tiene
// `.toDate()` igual que el SDK del cliente).

import type { Timestamp } from 'firebase-admin/firestore'

// Forma mínima de una transacción tal como vive en Firestore (Admin SDK).
// Sólo los campos que la hoja necesita; el resto se ignora.
// F6: ampliada para el modelo de Ecore (receivable, customer/company, partial,
// abonos denormalizados, préstamos entre locales y cuenta de caja).
export interface AdminTx {
  id: string
  concept?: string
  category?: string
  amount?: number
  type?: 'income' | 'expense'
  status: 'paid' | 'pending' | 'overdue' | 'partial'
  date?: Timestamp
  paidDate?: Timestamp
  dueDate?: Timestamp
  notes?: string
  payeeRef?: {
    type: 'partner' | 'employee' | 'supplier' | 'external' | 'customer' | 'company'
    id: string
    name?: string
  }
  documentKind?: 'invoice' | 'purchase' | 'receivable' | 'extra'
  docNumber?: string
  priority?: 'immediate' | 'waiting'
  paymentMethod?: string
  accountId?: string
  paidAmount?: number
  remainingAmount?: number
  // Retención en la fuente practicada al proveedor (Ecore). NO reduce el gasto:
  // `amount` sigue siendo el bruto causado. Reduce el neto a girar, y esa
  // diferencia queda como obligación con la DIAN.
  withholdingAmount?: number
  withholdingConcept?: string
  withholdingRate?: number
  interLocalGroupId?: string
  // Gasto compartido entre locales: `amount` es sólo la parte de ESTA compañía.
  splitGroupId?: string
  splitTotalAmount?: number
  splitSharePct?: number
}

// Traslado entre métodos de pago (Ecore: companies/{id}/transfers).
// fromMethod/toMethod son el NOMBRE del método de pago (igual que Payment.method).
export interface AdminTransfer {
  id: string
  fromMethod?: string
  toMethod?: string
  amount?: number
  date?: Timestamp
  reference?: string
  notes?: string
}

// Abono de una factura/CxC (Ecore: transactions/{txId}/payments).
export interface AdminPayment {
  id: string
  amount?: number
  date?: Timestamp
  accountId?: string
  method?: string
  notes?: string
}

// Una tx gestionada por Ecore (con abonos) y sus abonos cargados.
export interface ManagedTx {
  tx: AdminTx
  payments: AdminPayment[]
}

export interface FieldDef {
  key: string
  header: string
  type: 'string' | 'number'
}

export interface AccountingRow {
  [key: string]: string | number
  numeracion: string
  fecha: string
  nit: string
  proveedor: string
  concepto: string
  categoria: string
  prioridad: string
  tipo: string
  numero: string
  valor: number
  estado: string
  metodoPago: string
  notas: string
}

export const ACCOUNTING_FIELDS: FieldDef[] = [
  { key: 'numeracion', header: 'Numeración', type: 'string' },
  { key: 'fecha', header: 'Fecha', type: 'string' },
  { key: 'nit', header: 'NIT', type: 'string' },
  { key: 'proveedor', header: 'Proveedor', type: 'string' },
  { key: 'concepto', header: 'Concepto', type: 'string' },
  { key: 'categoria', header: 'Categoría', type: 'string' },
  { key: 'prioridad', header: 'Prioridad', type: 'string' },
  { key: 'tipo', header: 'Tipo', type: 'string' },
  { key: 'numero', header: 'Número', type: 'string' },
  { key: 'valor', header: 'Valor', type: 'number' },
  { key: 'estado', header: 'Estado', type: 'string' },
  { key: 'metodoPago', header: 'Metodo Pago', type: 'string' },
  { key: 'notas', header: 'Notas', type: 'string' },
]

// Fecha DD/MM/AAAA. Devuelve '—' cuando no hay fecha (data legacy).
function formatDate(ts: Timestamp | undefined): string {
  const d = ts?.toDate?.()
  if (!d) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function tipoLabel(t: AdminTx): string {
  if (t.documentKind === 'receivable') return 'Cuenta por cobrar'
  // Turno extra pagado a una persona (Ecore): no es compra a un proveedor.
  if (t.documentKind === 'extra') return 'Extra'
  return t.documentKind === 'invoice' ? 'Factura' : 'Compra'
}

function estadoLabel(status: AdminTx['status']): string {
  if (status === 'paid') return 'Pagado'
  if (status === 'partial') return 'Parcial'
  if (status === 'overdue') return 'Vencida'
  return 'Pendiente'
}

// Abonado / retenido / saldo / % a partir de los denormalizados de Ecore, con
// fallback para data sin abonos (paid → todo abonado; resto → nada abonado).
//
// El % y el saldo van contra el NETO a girar (valor − retefuente), no contra el
// bruto: si no, una factura con retención saldada mostraría saldo fantasma y un
// "% Pagado" de 98% que nunca llega a 100.
function paidParts(t: AdminTx): { paid: number; retenido: number; saldo: number; pct: string } {
  const amount = t.amount ?? 0
  const retenido = Math.max(0, t.withholdingAmount ?? 0)
  const payable = Math.max(0, amount - retenido)
  const paid = t.paidAmount ?? (t.status === 'paid' ? payable : 0)
  const saldo = t.remainingAmount ?? Math.max(payable - paid, 0)
  const pct = payable > 0 ? `${Math.round((paid / payable) * 100)}%` : '0%'
  return { paid, retenido, saldo, pct }
}

// Misma sanitización que doc-naming.sanitizeForFileName para que la Numeración
// coincida con el nombre real del PDF en Drive.
function sanitize(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim()
}

function buildNumeracion(index: number, t: AdminTx): string {
  const proveedor = sanitize(t.payeeRef?.name ?? 'Proveedor')
  const numero = sanitize(t.docNumber ?? '')
  return `${index}. ${proveedor} - ${tipoLabel(t)}${numero ? ` ${numero}` : ''}`
}

// Replica de parseCategory: "Categoría > Subcategoría" → "Categoría".
function parseCategoryName(value: string): string {
  return value.split(' > ')[0] ?? ''
}

// Concepto con la marca del reparto cuando la factura es un gasto compartido
// entre locales. Sin ella, la contadora ve el mismo número de factura en dos
// hojas con dos valores distintos y ninguno cuadra contra el documento físico.
// Va en Concepto y no en Numeración: esa última debe seguir coincidiendo
// exactamente con el nombre del PDF en Drive.
function conceptoLabel(t: AdminTx): string {
  const concepto = t.concept ?? ''
  const marks: string[] = []

  const id = t.splitGroupId
  const isShared = !!id && (id.startsWith('split-') || id.startsWith('rsplit-'))
  if (isShared && t.splitTotalAmount != null) {
    const share = t.splitSharePct != null ? `${t.splitSharePct}% ` : ''
    marks.push(`compartida — ${share}de $${t.splitTotalAmount.toLocaleString('es-CO')}`)
  }

  // Retefuente: en las pestañas Pendientes/Pagadas sólo se ve la columna Valor,
  // que es el bruto causado. Sin esta marca el egreso del banco no cuadra
  // contra la fila y parece un error.
  const retenido = Math.max(0, t.withholdingAmount ?? 0)
  if (retenido > 0) {
    const tarifa = t.withholdingRate != null ? ` ${t.withholdingRate}%` : ''
    const nombre = t.withholdingConcept ? ` ${t.withholdingConcept}` : ''
    marks.push(
      `retefuente${nombre}${tarifa} −$${retenido.toLocaleString('es-CO')}` +
        ` — girado $${Math.max(0, (t.amount ?? 0) - retenido).toLocaleString('es-CO')}`,
    )
  }

  return marks.length ? `${concepto} [${marks.join('] [')}]` : concepto
}

export function buildAccountingRows(
  txs: AdminTx[],
  suppliersById: Map<string, string>,
  startIndex = 1,
): AccountingRow[] {
  return txs.map((t, i) => {
    const nit =
      t.payeeRef?.type === 'supplier' && t.payeeRef.id
        ? suppliersById.get(t.payeeRef.id) ?? ''
        : ''
    return {
      numeracion: buildNumeracion(startIndex + i, t),
      fecha: formatDate(t.date),
      nit,
      proveedor: t.payeeRef?.name ?? '',
      concepto: conceptoLabel(t),
      categoria: parseCategoryName(t.category ?? ''),
      prioridad: t.priority === 'immediate' ? 'Inmediato' : 'Espera',
      tipo: tipoLabel(t),
      numero: t.docNumber ?? '',
      valor: t.amount ?? 0,
      estado: estadoLabel(t.status),
      metodoPago: t.paymentMethod ?? '',
      notas: t.notes ?? '',
    }
  })
}

// ───────────────────────────────────────────────────────────────────────────
// F6 — Pestañas del modelo Ecore (Por Pagar / Por Cobrar / Entre Locales /
// Abonos / Traslados). Filas planas; el layout lo da build-workbook.
// ───────────────────────────────────────────────────────────────────────────

// Por Pagar / Por Cobrar comparten estructura; solo cambia el header del tercero.
function payableFields(terceroHeader: string): FieldDef[] {
  return [
    { key: 'numeracion', header: 'Numeración', type: 'string' },
    { key: 'fecha', header: 'Fecha', type: 'string' },
    { key: 'vencimiento', header: 'Vencimiento', type: 'string' },
    { key: 'nit', header: 'NIT', type: 'string' },
    { key: 'tercero', header: terceroHeader, type: 'string' },
    { key: 'concepto', header: 'Concepto', type: 'string' },
    { key: 'categoria', header: 'Categoría', type: 'string' },
    { key: 'numero', header: 'Número', type: 'string' },
    { key: 'valor', header: 'Valor', type: 'number' },
    { key: 'retefuente', header: 'Retefuente', type: 'number' },
    { key: 'abonado', header: 'Abonado', type: 'number' },
    { key: 'saldo', header: 'Saldo', type: 'number' },
    { key: 'porcentaje', header: '% Pagado', type: 'string' },
    { key: 'estado', header: 'Estado', type: 'string' },
    { key: 'notas', header: 'Notas', type: 'string' },
  ]
}
export const PAYABLE_FIELDS = payableFields('Proveedor')
export const RECEIVABLE_FIELDS = payableFields('Cliente')

export function buildPayableRows(
  txs: AdminTx[],
  suppliersById: Map<string, string>,
  startIndex = 1,
): Record<string, string | number>[] {
  return txs.map((t, i) => {
    const nit =
      t.payeeRef?.type === 'supplier' && t.payeeRef.id
        ? suppliersById.get(t.payeeRef.id) ?? ''
        : ''
    const { paid, retenido, saldo, pct } = paidParts(t)
    return {
      numeracion: buildNumeracion(startIndex + i, t),
      fecha: formatDate(t.date),
      vencimiento: t.dueDate ? formatDate(t.dueDate) : '—',
      nit,
      tercero: t.payeeRef?.name ?? '',
      concepto: conceptoLabel(t),
      categoria: parseCategoryName(t.category ?? ''),
      numero: t.docNumber ?? '',
      valor: t.amount ?? 0,
      retefuente: retenido,
      abonado: paid,
      saldo,
      porcentaje: pct,
      estado: estadoLabel(t.status),
      notas: t.notes ?? '',
    }
  })
}

export const INTERLOCAL_FIELDS: FieldDef[] = [
  { key: 'fecha', header: 'Fecha', type: 'string' },
  { key: 'rol', header: 'Rol', type: 'string' },
  { key: 'contraparte', header: 'Contraparte', type: 'string' },
  { key: 'concepto', header: 'Concepto', type: 'string' },
  { key: 'valor', header: 'Valor', type: 'number' },
  { key: 'abonado', header: 'Abonado', type: 'number' },
  { key: 'saldo', header: 'Saldo', type: 'number' },
  { key: 'porcentaje', header: '% Pagado', type: 'string' },
  { key: 'estado', header: 'Estado', type: 'string' },
]

export function buildInterLocalRows(txs: AdminTx[]): Record<string, string | number>[] {
  return txs.map((t) => {
    const { paid, saldo, pct } = paidParts(t)
    return {
      fecha: formatDate(t.date),
      rol: t.type === 'income' ? 'Por cobrar' : 'Por pagar',
      contraparte: t.payeeRef?.name ?? '',
      concepto: t.concept ?? '',
      valor: t.amount ?? 0,
      abonado: paid,
      saldo,
      porcentaje: pct,
      estado: estadoLabel(t.status),
    }
  })
}

export const TRANSFER_FIELDS: FieldDef[] = [
  { key: 'fecha', header: 'Fecha', type: 'string' },
  { key: 'origen', header: 'Origen', type: 'string' },
  { key: 'destino', header: 'Destino', type: 'string' },
  { key: 'valor', header: 'Monto', type: 'number' },
  { key: 'referencia', header: 'Referencia', type: 'string' },
  { key: 'notas', header: 'Notas', type: 'string' },
]

export function buildTransferRows(
  transfers: AdminTransfer[],
): Record<string, string | number>[] {
  return transfers
    .slice()
    .sort((a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0))
    .map((tr) => ({
      fecha: formatDate(tr.date),
      origen: tr.fromMethod ?? '',
      destino: tr.toMethod ?? '',
      valor: tr.amount ?? 0,
      referencia: tr.reference ?? '',
      notas: tr.notes ?? '',
    }))
}

export const PAYMENT_FIELDS: FieldDef[] = [
  { key: 'factura', header: 'Factura', type: 'string' },
  { key: 'tercero', header: 'Tercero', type: 'string' },
  { key: 'fecha', header: 'Fecha abono', type: 'string' },
  { key: 'valor', header: 'Monto', type: 'number' },
  { key: 'acumulado', header: '% Acumulado', type: 'string' },
  { key: 'saldo', header: 'Saldo', type: 'number' },
  { key: 'metodo', header: 'Método', type: 'string' },
]

// Aplana los abonos de las tx gestionadas. Por factura: ordena por fecha y lleva
// suma corriente para % acumulado y saldo restante tras cada abono.
export function buildPaymentRows(
  groups: ManagedTx[],
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = []
  for (const { tx, payments } of groups) {
    // Neto a girar: los abonos cubren esto, no el bruto (ver paidParts).
    const amount = Math.max(0, (tx.amount ?? 0) - Math.max(0, tx.withholdingAmount ?? 0))
    const facturaLabel = `${tx.concept ?? ''}${tx.docNumber ? ` (${tx.docNumber})` : ''}`.trim()
    const ordered = payments
      .slice()
      .sort((a, b) => (a.date?.toMillis?.() ?? 0) - (b.date?.toMillis?.() ?? 0))
    let running = 0
    for (const p of ordered) {
      running += p.amount ?? 0
      rows.push({
        factura: facturaLabel || '—',
        tercero: tx.payeeRef?.name ?? '',
        fecha: formatDate(p.date),
        valor: p.amount ?? 0,
        acumulado: amount > 0 ? `${Math.round((running / amount) * 100)}%` : '—',
        saldo: Math.max(amount - running, 0),
        metodo: p.method ?? '',
      })
    }
  }
  return rows
}

