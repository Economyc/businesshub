import type { Timestamp } from 'firebase/firestore'
import type { BaseEntity, TransactionType, TransactionStatus } from '@/core/types'

export type PayeeType = 'partner' | 'employee' | 'supplier' | 'external'

// A quien le debemos esta transaccion. Se puebla cuando alguien (un socio, un
// empleado, un proveedor a credito o un tercero) adelanta la plata o nos vende
// a credito y quedamos con la deuda. Cartera lee payeeRef.name como
// counterparty cuando existe.
export interface PayeeRef {
  type: PayeeType
  id: string
  name: string
}

// Archivo asociado a una transacción (factura, comprobante de pago, recibo de
// compra). Vive en Google Drive — el cliente solo guarda el ID, el link de
// visualización y metadata mínima. El archivo en sí no se duplica en Firestore.
export interface PayableFile {
  driveFileId: string
  driveWebViewLink: string
  fileName: string
  mimeType: string
  uploadedAt: Timestamp
}

// Distingue dos tipos de transaction documentada:
//  - 'invoice': factura/cuenta de cobro a crédito (status='pending' al crear,
//    luego se cruza con un comprobante de pago para pasar a 'paid').
//  - 'purchase': compra al contado, status='paid' desde el inicio.
// Para egresos no documentados (recurrentes, cierre de caja, etc.) este campo
// queda undefined y la transaction se comporta como antes.
export type DocumentKind = 'invoice' | 'purchase'

// Prioridad de pago para facturas/compras pendientes. 'immediate' marca
// la fila en rojo en la tabla (hay que pagar ya), 'waiting' es el default
// (gris, sin urgencia). Solo aplica cuando documentKind está presente.
export type TransactionPriority = 'immediate' | 'waiting'

export interface Transaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  date: Timestamp
  status: TransactionStatus
  notes?: string
  sourceType?: 'closing' | 'recurring'
  sourceId?: string
  sourceLabel?: string
  payeeRef?: PayeeRef
  splitGroupId?: string
  documentKind?: DocumentKind
  docNumber?: string
  sourceDocument?: PayableFile
  paymentProof?: PayableFile
  // PDF generado fusionando factura + comprobante en un solo archivo (para la
  // contadora). Se genera al cruzar el pago o con el botón retroactivo. Los
  // originales (sourceDocument/paymentProof) se conservan.
  combinedDocument?: PayableFile
  paidDate?: Timestamp
  // Fecha de devengo contable. Solo la pueblan nómina y propinas: se reconocen
  // en el mes en que se devengaron (p.ej. Q2 mayo), no en el de pago (p.ej. 1
  // jun). El resto de gastos la dejan undefined → se ubican por paidDate ?? date
  // como siempre. Ver utils/accrual-period.ts y recognitionDate en hooks.ts.
  accrualDate?: Timestamp
  priority?: TransactionPriority
  // Método de pago elegido al montar la compra de contado o al cruzar el pago
  // de una factura. Texto libre tomado del catálogo por empresa (settings/
  // paymentMethods). Se vuelca a la columna "Metodo Pago" del Sheet.
  paymentMethod?: string
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTransaction extends BaseEntity {
  concept: string
  category: string
  amount: number
  type: TransactionType
  status: TransactionStatus
  notes?: string
  frequency: RecurrenceFrequency
  startDate: Timestamp
  endDate?: Timestamp
  nextDueDate: Timestamp
  lastGeneratedDate?: Timestamp
  isActive: boolean
  // Campos opcionales que se propagan a cada transacción generada. Los usa
  // el reparto recurrente entre locales (gasto compartido mensual): la regla
  // guarda payeeRef/documentKind/priority y un splitGroupId "de grupo"; el
  // generador deriva un splitGroupId por ocurrencia (mes) a partir de él.
  payeeRef?: PayeeRef
  documentKind?: DocumentKind
  priority?: TransactionPriority
  splitGroupId?: string
}

export type RecurringTransactionFormData = Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>

export type TransactionFormData = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export interface BudgetItem {
  category: string
  type: TransactionType
  amount: number
}

export interface BudgetConfig {
  items: BudgetItem[]
}
