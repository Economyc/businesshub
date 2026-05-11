import { motion } from 'framer-motion'
import { DollarSign, CreditCard, Package } from 'lucide-react'
import { KPICard } from '@/core/ui/kpi-card'
import { KPICardSkeleton } from '@/core/ui/skeleton'
import { staggerContainer } from '@/core/animations/variants'
import type { DashboardKPIs } from '../hooks'

interface KPICardsRowProps {
  kpis: DashboardKPIs
  periodLabel: string
  comparisonLabel: string
  ventasLoading?: boolean
  gastosLoading?: boolean
  costoLoading?: boolean
}

export function KPICardsRow({
  kpis,
  periodLabel,
  comparisonLabel,
  ventasLoading,
  gastosLoading,
  costoLoading,
}: KPICardsRowProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {ventasLoading ? (
        <KPICardSkeleton />
      ) : (
        <KPICard
          label={`Ventas — ${periodLabel}`}
          value={kpis.ventasHoy}
          format="currency"
          change={kpis.ventasHoyChange}
          trend={kpis.ventasHoyTrend}
          comparison={comparisonLabel}
          icon={DollarSign}
        />
      )}
      {gastosLoading ? (
        <KPICardSkeleton />
      ) : (
        <KPICard
          label={`Gastos — ${periodLabel}`}
          value={kpis.gastosMes}
          format="currency"
          change={kpis.gastosMesChange}
          trend={kpis.gastosMesTrend}
          comparison={comparisonLabel}
          icon={CreditCard}
          inverse
        />
      )}
      {costoLoading ? (
        <KPICardSkeleton />
      ) : (
        <KPICard
          label={`Costo — ${periodLabel}`}
          value={kpis.costo}
          format="currency"
          change={kpis.costoChange}
          trend={kpis.costoTrend}
          comparison={comparisonLabel}
          icon={Package}
          inverse
        />
      )}
    </motion.div>
  )
}
