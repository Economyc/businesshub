import { motion } from 'framer-motion'
import { DollarSign, CreditCard, Percent, Clock } from 'lucide-react'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import type { DashboardKPIs } from '../hooks'

interface KPICardsRowProps {
  kpis: DashboardKPIs
}

export function KPICardsRow({ kpis }: KPICardsRowProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <KPICard
        label="Ventas hoy"
        value={kpis.ventasHoy}
        format="currency"
        change={kpis.ventasHoyChange}
        trend={kpis.ventasHoyTrend}
        icon={DollarSign}
      />
      <KPICard
        label="Gastos del mes"
        value={kpis.gastosMes}
        format="currency"
        change={kpis.gastosMesChange}
        trend={kpis.gastosMesTrend}
        icon={CreditCard}
      />
      <KPICard
        label="Margen neto"
        value={Math.round(kpis.margenNeto)}
        format="number"
        change={kpis.margenNetoChange}
        trend={kpis.margenNetoTrend}
        icon={Percent}
      />
      <KPICard
        label="Por cobrar"
        value={kpis.porCobrar}
        format="currency"
        change={kpis.porCobrarChange}
        trend={kpis.porCobrarTrend}
        icon={Clock}
      />
    </motion.div>
  )
}
