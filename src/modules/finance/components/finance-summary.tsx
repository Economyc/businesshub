import { motion } from 'framer-motion'
import { DollarSign, BarChart3 } from 'lucide-react'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { useFinanceSummary } from '../hooks'

export function FinanceSummary() {
  const { summary, loading } = useFinanceSummary()

  if (loading) return null

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-3 gap-4 mb-6"
    >
      <KPICard
        label="Ingresos"
        value={summary.income}
        format="currency"
        trend="up"
        icon={DollarSign}
      />
      <KPICard
        label="Gastos"
        value={summary.expenses}
        format="currency"
        trend="down"
        icon={DollarSign}
      />
      <KPICard
        label="Balance"
        value={summary.balance}
        format="currency"
        trend={summary.balance >= 0 ? 'up' : 'down'}
        icon={BarChart3}
      />
    </motion.div>
  )
}
