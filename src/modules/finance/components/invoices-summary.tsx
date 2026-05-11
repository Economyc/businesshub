import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, CheckCircle2 } from 'lucide-react'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import type { Transaction } from '../types'

interface InvoicesSummaryProps {
  // Todas las pendientes — sin filtro de rango (son arrastres de deuda).
  pending: Transaction[]
  // Pagadas dentro del rango actual (por paidDate).
  paid: Transaction[]
}

export function InvoicesSummary({ pending, paid }: InvoicesSummaryProps) {
  const summary = useMemo(() => {
    const pendingTotal = pending.reduce((s, t) => s + (t.amount || 0), 0)
    const pendingWithValue = pending.filter((t) => (t.amount || 0) > 0).length

    const purchases = paid.filter((t) => t.documentKind === 'purchase')
    const purchasesTotal = purchases.reduce((s, t) => s + (t.amount || 0), 0)
    const paidTotal = paid.reduce((s, t) => s + (t.amount || 0), 0)

    return {
      pending: {
        total: pendingTotal,
        withValue: pendingWithValue,
        count: pending.length,
      },
      paid: {
        total: paidTotal,
        purchasesTotal,
        purchasesCount: purchases.length,
      },
    }
  }, [pending, paid])

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
    >
      <KPICard
        label="Pendiente"
        value={summary.pending.total}
        format="currency"
        icon={Clock}
        comparison={`${summary.pending.withValue}/${summary.pending.count} con valor`}
      />
      <KPICard
        label="Pagado"
        value={summary.paid.total}
        format="currency"
        icon={CheckCircle2}
        comparison={
          summary.paid.purchasesCount > 0
            ? `incluye ${Math.round(summary.paid.purchasesTotal).toLocaleString('es-CO')} de ${summary.paid.purchasesCount} ${summary.paid.purchasesCount === 1 ? 'compra' : 'compras'}`
            : 'sin compras al contado'
        }
      />
    </motion.div>
  )
}
