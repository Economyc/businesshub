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

  const efectivoNeto = Math.max((closing.efectivo ?? 0) - (closing.ap ?? 0), 0)

  const channels: { amount: number; concept: string; category: string; type: 'income' | 'expense'; status: TransactionData['status'] }[] = [
    { amount: efectivoNeto, concept: `Ventas Efectivo - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income', status: 'paid' },
    { amount: closing.datafono ?? 0, concept: `Ventas Datáfono - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income', status: 'paid' },
    { amount: closing.qr ?? 0, concept: `Ventas QR - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income', status: 'paid' },
    { amount: closing.rappiVentas ?? 0, concept: `Ventas Rappi - ${formatClosingDate(closing.date)}`, category: 'Ventas', type: 'income', status: 'pending' },
    { amount: closing.propinas ?? 0, concept: `Propinas - ${formatClosingDate(closing.date)}`, category: 'Propinas', type: 'income', status: 'paid' },
    { amount: closing.gastos ?? 0, concept: `Gastos cierre - ${formatClosingDate(closing.date)}`, category: 'Gastos Operacionales', type: 'expense', status: 'paid' },
  ]

  const txsToCreate: TransactionData[] = []
  for (const ch of channels) {
    if (ch.amount > 0) {
      txsToCreate.push({
        concept: ch.concept,
        category: ch.category,
        amount: ch.amount,
        type: ch.type,
        date,
        status: ch.status,
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
