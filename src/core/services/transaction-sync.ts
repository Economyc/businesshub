import {
  writeBatch,
  getDocs,
  query,
  where,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { cacheDel } from '@/core/utils/cache'
import type { Closing } from '@/modules/closings/types'
import type { Purchase } from '@/modules/purchases/types'

type SourceType = 'closing' | 'purchase'

interface TransactionData {
  concept: string
  category: string
  amount: number
  type: 'income' | 'expense'
  date: Timestamp
  status: 'paid' | 'pending' | 'overdue'
  sourceType: SourceType
  sourceId: string
  sourceLabel: string
  notes?: string
}

function invalidateCache(companyId: string) {
  cacheDel(`col:${companyId}:transactions`)
}

function closingDateToTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr + 'T12:00:00'))
}

function formatClosingDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export async function deleteLinkedTransactions(
  companyId: string,
  sourceType: SourceType,
  sourceId: string
): Promise<void> {
  const ref = companyCollection(companyId, 'transactions')
  const q = query(
    ref,
    where('sourceType', '==', sourceType),
    where('sourceId', '==', sourceId)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return

  const batch = writeBatch(db)
  snapshot.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

export async function syncClosingTransactions(
  companyId: string,
  closingId: string,
  closing: Closing | Omit<Closing, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await deleteLinkedTransactions(companyId, 'closing', closingId)

  const date = closingDateToTimestamp(closing.date)
  const label = `Cierre ${formatClosingDate(closing.date)}`
  const now = Timestamp.now()

  const channels: { field: keyof typeof closing; concept: string; category: string; type: 'income' | 'expense' }[] = [
    { field: 'efectivo', concept: `Ventas Efectivo - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income' },
    { field: 'datafono', concept: `Ventas Datáfono - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income' },
    { field: 'qr', concept: `Ventas QR - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income' },
    { field: 'rappiVentas', concept: `Ventas Rappi - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income' },
    { field: 'propinas', concept: `Propinas - ${formatClosingDate(closing.date)}`, category: 'Propinas', type: 'income' },
    { field: 'gastos', concept: `Gastos cierre - ${formatClosingDate(closing.date)}`, category: 'Gastos Operacionales', type: 'expense' },
  ]

  const txsToCreate: TransactionData[] = []
  for (const ch of channels) {
    const amount = closing[ch.field] as number
    if (amount > 0) {
      txsToCreate.push({
        concept: ch.concept,
        category: ch.category,
        amount,
        type: ch.type,
        date,
        status: 'paid',
        sourceType: 'closing',
        sourceId: closingId,
        sourceLabel: label,
      })
    }
  }

  if (txsToCreate.length === 0) {
    invalidateCache(companyId)
    return
  }

  const ref = companyCollection(companyId, 'transactions')
  const batch = writeBatch(db)
  for (const tx of txsToCreate) {
    const newDoc = doc(ref)
    batch.set(newDoc, { ...tx, createdAt: now, updatedAt: now })
  }
  await batch.commit()
  invalidateCache(companyId)
}

export async function syncPurchaseTransaction(
  companyId: string,
  purchaseId: string,
  purchase: Purchase | Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await deleteLinkedTransactions(companyId, 'purchase', purchaseId)

  const invoice = purchase.invoiceNumber ? `#${purchase.invoiceNumber}` : ''
  const concept = `Compra ${invoice} - ${purchase.supplierName}`.replace('  ', ' ')
  const label = concept
  const now = Timestamp.now()

  const statusMap: Record<string, 'paid' | 'pending' | 'overdue'> = {
    paid: 'paid',
    pending: 'pending',
    overdue: 'overdue',
  }

  const tx: TransactionData = {
    concept,
    category: 'Insumos',
    amount: purchase.total,
    type: 'expense',
    date: purchase.date,
    status: statusMap[purchase.paymentStatus] ?? 'pending',
    sourceType: 'purchase',
    sourceId: purchaseId,
    sourceLabel: label,
  }

  const ref = companyCollection(companyId, 'transactions')
  const batch = writeBatch(db)
  const newDoc = doc(ref)
  batch.set(newDoc, { ...tx, createdAt: now, updatedAt: now })
  await batch.commit()
  invalidateCache(companyId)
}
