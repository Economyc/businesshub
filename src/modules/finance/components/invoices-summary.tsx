import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, CheckCircle2 } from 'lucide-react'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import type { Transaction } from '../types'

interface InvoicesSummaryProps {
  // Dataset ya filtrado por documentKind ∈ {invoice, purchase} y por rango.
  transactions: Transaction[]
}

export function InvoicesSummary({ transactions }: InvoicesSummaryProps) {
  const { pending, paid } = useMemo(() => {
    const pendingTxs = transactions.filter(
      (t) => t.status === 'pending' || t.status === 'overdue',
    )
    const paidTxs = transactions.filter((t) => t.status === 'paid')

    const pendingTotal = pendingTxs.reduce((s, t) => s + (t.amount || 0), 0)
    const pendingWithValue = pendingTxs.filter((t) => (t.amount || 0) > 0).length

    const purchases = paidTxs.filter((t) => t.documentKind === 'purchase')
    const purchasesTotal = purchases.reduce((s, t) => s + (t.amount || 0), 0)
    const paidTotal = paidTxs.reduce((s, t) => s + (t.amount || 0), 0)

    return {
      pending: {
        total: pendingTotal,
        withValue: pendingWithValue,
        count: pendingTxs.length,
      },
      paid: {
        total: paidTotal,
        purchasesTotal,
        purchasesCount: purchases.length,
      },
    }
  }, [transactions])

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
    >
      <KPICard
        label="Pendiente"
        value={pending.total}
        format="currency"
        icon={Clock}
        comparison={`${pending.withValue}/${pending.count} con valor`}
      />
      <KPICard
        label="Pagado"
        value={paid.total}
        format="currency"
        icon={CheckCircle2}
        comparison={
          paid.purchasesCount > 0
            ? `incluye ${Math.round(paid.purchasesTotal).toLocaleString('es-CO')} de ${paid.purchasesCount} ${paid.purchasesCount === 1 ? 'compra' : 'compras'}`
            : 'sin compras al contado'
        }
      />
    </motion.div>
  )
}
