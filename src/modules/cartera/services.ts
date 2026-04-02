import { where } from 'firebase/firestore'
import {
  fetchCollection,
  fetchDocument,
  createDocument,
  updateDocument,
  removeDocument,
} from '@/core/firebase/helpers'
import { financeService } from '@/modules/finance/services'
import { cacheDel } from '@/core/utils/cache'
import type { Transaction, TransactionFormData } from '@/modules/finance/types'
import type { Purchase } from '@/modules/purchases/types'
import type { Payment, PaymentFormData, PaymentTargetType } from './types'

const COLLECTION = 'payments'

export const paymentService = {
  getAll: (companyId: string) =>
    fetchCollection<Payment>(companyId, COLLECTION),

  getByTarget: (companyId: string, targetType: PaymentTargetType, targetId: string) =>
    fetchCollection<Payment>(
      companyId,
      COLLECTION,
      where('targetType', '==', targetType),
      where('targetId', '==', targetId)
    ),

  create: async (companyId: string, data: PaymentFormData) => {
    const id = await createDocument(companyId, COLLECTION, data)

    if (data.commission && data.commission > 0) {
      const commissionTx: TransactionFormData = {
        concept: `Comisión Rappi`,
        category: 'Comisiones Plataformas',
        amount: data.commission,
        type: 'expense',
        date: data.date,
        status: 'paid',
        notes: `Comisión retenida en pago de cartera`,
      }
      await financeService.create(companyId, commissionTx)
      cacheDel(`col:${companyId}:transactions`)
    }

    await reconcileTarget(companyId, data.targetType, data.targetId)
    cacheDel(`col:${companyId}:${COLLECTION}`)
    return id
  },

  remove: async (
    companyId: string,
    id: string,
    targetType: PaymentTargetType,
    targetId: string
  ) => {
    await removeDocument(companyId, COLLECTION, id)
    await reconcileTarget(companyId, targetType, targetId)
    cacheDel(`col:${companyId}:${COLLECTION}`)
  },
}

async function reconcileTarget(
  companyId: string,
  targetType: PaymentTargetType,
  targetId: string
): Promise<void> {
  const payments = await paymentService.getByTarget(companyId, targetType, targetId)
  const totalApplied = payments.reduce(
    (sum, p) => sum + p.amount + (p.commission ?? 0),
    0
  )

  if (targetType === 'transaction') {
    const tx = await fetchDocument<Transaction>(companyId, 'transactions', targetId)
    if (!tx) return
    const newStatus = totalApplied >= tx.amount ? 'paid' : 'pending'
    if (tx.status !== newStatus) {
      await updateDocument(companyId, 'transactions', targetId, { status: newStatus })
      cacheDel(`col:${companyId}:transactions`)
    }
  } else {
    const purchase = await fetchDocument<Purchase>(companyId, 'purchases', targetId)
    if (!purchase) return
    const newStatus = totalApplied >= purchase.total ? 'paid' : 'pending'
    if (purchase.paymentStatus !== newStatus) {
      await updateDocument(companyId, 'purchases', targetId, { paymentStatus: newStatus })
      cacheDel(`col:${companyId}:purchases`)
      // Also re-sync the mirrored transaction
      const { syncPurchaseTransaction } = await import('@/core/services/transaction-sync')
      await syncPurchaseTransaction(companyId, targetId, { ...purchase, paymentStatus: newStatus })
    }
  }
}
