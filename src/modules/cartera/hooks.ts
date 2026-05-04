import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { doc, getDoc, type Timestamp } from 'firebase/firestore'
import { useCollection } from '@/core/hooks/use-firestore'
import { useCompany } from '@/core/hooks/use-company'
import { db } from '@/core/firebase/config'
import { useTransactions } from '@/modules/finance/hooks'
import { usePurchases } from '@/modules/purchases/hooks'
import type { Payment, CarteraItem, CarteraSummary } from './types'

export function usePayments() {
  return useCollection<Payment>('payments')
}

// Resumen denormalizado escrito por la Cloud Function `carteraSummaryNightly`.
// El Home lo consume en vez de useCarteraItems/useCarteraSummary para evitar
// descargar transactions+purchases+payments completos. Tiene hasta 24h de
// desfase frente a los datos en vivo; la pantalla /cartera sigue usando los
// hooks live para mostrar detalle interactivo.
export interface CarteraOverviewItem {
  id: string
  concept: string
  balance: number
  daysOutstanding: number
}

export interface CarteraOverview {
  totalReceivables: number
  totalPayables: number
  netPosition: number
  overdueTotal: number
  receivablesOverdueCount: number
  receivablesPendingCount: number
  payablesOverdueCount: number
  payablesPendingCount: number
  overdueReceivables: CarteraOverviewItem[]
  overduePayables: CarteraOverviewItem[]
  computedAt: Timestamp | null
}

const EMPTY_OVERVIEW: CarteraOverview = {
  totalReceivables: 0,
  totalPayables: 0,
  netPosition: 0,
  overdueTotal: 0,
  receivablesOverdueCount: 0,
  receivablesPendingCount: 0,
  payablesOverdueCount: 0,
  payablesPendingCount: 0,
  overdueReceivables: [],
  overduePayables: [],
  computedAt: null,
}

export function useCarteraOverview() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cartera-overview', companyId],
    queryFn: async (): Promise<CarteraOverview> => {
      const ref = doc(db, 'companies', companyId!, 'summary', 'cartera')
      const snap = await getDoc(ref)
      if (!snap.exists()) return EMPTY_OVERVIEW
      const raw = snap.data() as Partial<CarteraOverview>
      return { ...EMPTY_OVERVIEW, ...raw }
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    overview: data ?? EMPTY_OVERVIEW,
    loading: isLoading,
    error: error as Error | null,
    refetch,
  }
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function computeStatus(
  balance: number,
  originalAmount: number,
  dueDate: Date | undefined,
  existingStatus?: CarteraItem['status']
): CarteraItem['status'] {
  if (balance <= 0) return 'paid'
  if (existingStatus === 'overdue') return 'overdue'
  if (dueDate && dueDate < new Date()) return 'overdue'
  if (balance < originalAmount) return 'partial'
  return 'pending'
}

export function useCarteraItems() {
  const { data: transactions, loading: txLoading } = useTransactions()
  const { data: purchases, loading: purLoading } = usePurchases()
  const { data: payments, loading: payLoading } = usePayments()

  const { receivables, payables } = useMemo(() => {
    const now = new Date()
    const paymentsByTarget = new Map<string, Payment[]>()
    for (const p of payments) {
      const key = `${p.targetType}:${p.targetId}`
      if (!paymentsByTarget.has(key)) paymentsByTarget.set(key, [])
      paymentsByTarget.get(key)!.push(p)
    }

    // Receivables: income transactions that are not yet paid
    const receivables: CarteraItem[] = transactions
      .filter((t) => t.type === 'income' && t.status !== 'paid')
      .map((t) => {
        const txPayments = paymentsByTarget.get(`transaction:${t.id}`) ?? []
        const paidAmount = txPayments.reduce((s, p) => s + p.amount, 0)
        const commissionAmount = txPayments.reduce((s, p) => s + (p.commission ?? 0), 0)
        const totalApplied = paidAmount + commissionAmount
        const balance = Math.max(t.amount - totalApplied, 0)
        const txDate = t.date?.toDate?.() ?? now
        const days = daysBetween(txDate, now)

        return {
          id: t.id,
          type: 'receivable' as const,
          sourceType: 'transaction' as const,
          concept: t.concept,
          counterparty: t.payeeRef?.name ?? t.sourceLabel ?? t.category,
          originalAmount: t.amount,
          paidAmount,
          commissionAmount,
          balance,
          date: t.date,
          status: computeStatus(balance, t.amount, undefined, t.status as CarteraItem['status']),
          daysOutstanding: days,
          payments: txPayments,
        }
      })

    // Expense transactions pendientes — gastos que no son compras formales pero
    // estan abiertos. Sirven para los casos: alguien adelanto la plata
    // (payeeRef apunta a partner/employee/external) o un proveedor que nos
    // vendio a credito sin compra registrada (payeeRef apunta a supplier).
    // Filtramos las que vienen de purchases para no duplicar (esas ya las
    // incluimos abajo con su info real).
    const expensePayables: CarteraItem[] = transactions
      .filter((t) => t.type === 'expense' && t.status !== 'paid' && t.sourceType !== 'purchase')
      .map((t) => {
        const txPayments = paymentsByTarget.get(`transaction:${t.id}`) ?? []
        const paidAmount = txPayments.reduce((s, p) => s + p.amount, 0)
        const commissionAmount = txPayments.reduce((s, p) => s + (p.commission ?? 0), 0)
        const totalApplied = paidAmount + commissionAmount
        const balance = Math.max(t.amount - totalApplied, 0)
        const txDate = t.date?.toDate?.() ?? now
        const days = daysBetween(txDate, now)

        return {
          id: t.id,
          type: 'payable' as const,
          sourceType: 'transaction' as const,
          concept: t.concept,
          counterparty: t.payeeRef?.name ?? t.sourceLabel ?? t.category,
          originalAmount: t.amount,
          paidAmount,
          commissionAmount,
          balance,
          date: t.date,
          status: computeStatus(balance, t.amount, undefined, t.status as CarteraItem['status']),
          daysOutstanding: days,
          payments: txPayments,
        }
      })

    // Payables: purchases not yet fully paid
    const purchasePayables: CarteraItem[] = purchases
      .filter((p) => p.paymentStatus !== 'paid')
      .map((p) => {
        const purPayments = paymentsByTarget.get(`purchase:${p.id}`) ?? []
        const paidAmount = purPayments.reduce((s, py) => s + py.amount, 0)
        const commissionAmount = purPayments.reduce((s, py) => s + (py.commission ?? 0), 0)
        const totalApplied = paidAmount + commissionAmount
        const balance = Math.max(p.total - totalApplied, 0)
        const purDate = p.date?.toDate?.() ?? now
        const dueDate = p.paymentDueDate?.toDate?.()
        const days = daysBetween(purDate, now)

        return {
          id: p.id,
          type: 'payable' as const,
          sourceType: 'purchase' as const,
          concept: p.invoiceNumber ? `Compra #${p.invoiceNumber} - ${p.supplierName}` : `Compra - ${p.supplierName}`,
          counterparty: p.supplierName,
          originalAmount: p.total,
          paidAmount,
          commissionAmount,
          balance,
          date: p.date,
          dueDate: p.paymentDueDate,
          status: computeStatus(balance, p.total, dueDate, p.paymentStatus as CarteraItem['status']),
          daysOutstanding: days,
          payments: purPayments,
        }
      })

    const payables = [...purchasePayables, ...expensePayables]
    return { receivables, payables }
  }, [transactions, purchases, payments])

  return {
    receivables,
    payables,
    loading: txLoading || purLoading || payLoading,
  }
}

export function useCarteraSummary() {
  const { receivables, payables, loading } = useCarteraItems()

  const summary = useMemo<CarteraSummary>(() => {
    const totalReceivables = receivables.reduce((s, r) => s + r.balance, 0)
    const totalPayables = payables.reduce((s, p) => s + p.balance, 0)
    const overdueReceivables = receivables
      .filter((r) => r.status === 'overdue')
      .reduce((s, r) => s + r.balance, 0)
    const overduePayables = payables
      .filter((p) => p.status === 'overdue')
      .reduce((s, p) => s + p.balance, 0)

    return {
      totalReceivables,
      totalPayables,
      netPosition: totalReceivables - totalPayables,
      overdueTotal: overdueReceivables + overduePayables,
    }
  }, [receivables, payables])

  return { summary, loading }
}
