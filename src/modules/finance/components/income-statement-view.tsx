import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight as ChevronClosed,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
} from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useIncomeStatement } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { FinanceTabs } from './finance-tabs'
import type { IncomeStatementSection, CategoryBreakdown } from '../hooks'

function DetailRow({ item }: { item: CategoryBreakdown }) {
  const [expanded, setExpanded] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const dateGroups = useMemo(() => {
    const map = new Map<string, { dateLabel: string; total: number; transactions: typeof item.transactions }>()

    for (const t of item.transactions) {
      const d = t.date?.toDate?.()
      const key = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : '0000-00-00'
      if (!map.has(key)) {
        const label = d
          ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })
          : 'Sin fecha'
        map.set(key, { dateLabel: label, total: 0, transactions: [] })
      }
      const group = map.get(key)!
      group.total += t.amount
      group.transactions.push(t)
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ dateKey: key, ...val }))
  }, [item.transactions])

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bone/50 transition-colors duration-150 rounded-lg"
      >
        <div className="flex items-center gap-2">
          {item.transactions.length > 0 ? (
            expanded ? (
              <ChevronDown size={14} className="text-mid-gray" />
            ) : (
              <ChevronClosed size={14} className="text-mid-gray" />
            )
          ) : (
            <span className="w-3.5" />
          )}
          <span className="text-body text-graphite">{item.category}</span>
          <span className="text-caption text-mid-gray">({item.transactions.length})</span>
        </div>
        <span className="text-body font-medium text-dark-graphite">
          {formatCurrency(item.total)}
        </span>
      </button>
      <AnimatePresence>
        {expanded && item.transactions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {dateGroups.map((group) => {
              const isDateExpanded = expandedDates.has(group.dateKey)
              return (
                <div key={group.dateKey}>
                  {/* Date sub-group header */}
                  <button
                    onClick={() => toggleDate(group.dateKey)}
                    className="w-full flex items-center justify-between pl-10 pr-4 py-2 hover:bg-bone/30 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2">
                      {group.transactions.length > 1 ? (
                        isDateExpanded ? (
                          <ChevronDown size={12} className="text-mid-gray" />
                        ) : (
                          <ChevronClosed size={12} className="text-mid-gray" />
                        )
                      ) : (
                        <span className="w-3" />
                      )}
                      <span className="text-caption text-graphite capitalize">{group.dateLabel}</span>
                      <span className="text-caption text-smoke">({group.transactions.length})</span>
                    </div>
                    <span className="text-caption font-medium text-dark-graphite">
                      {formatCurrency(group.total)}
                    </span>
                  </button>

                  {/* Individual transactions within date */}
                  <AnimatePresence>
                    {isDateExpanded && group.transactions.length > 1 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        {group.transactions.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between pl-16 pr-4 py-1.5 text-caption text-mid-gray"
                          >
                            <span>{t.concept}</span>
                            <span>{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatementSection({ section }: { section: IncomeStatementSection }) {
  const [collapsed, setCollapsed] = useState(false)

  if (section.categories.length === 0 && section.total === 0) return null

  return (
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-bone/30 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronClosed size={16} className="text-mid-gray" />
          ) : (
            <ChevronDown size={16} className="text-mid-gray" />
          )}
          <span className="text-body font-semibold text-dark-graphite uppercase tracking-wide text-[13px]">
            {section.label}
          </span>
        </div>
        <span className="text-body font-semibold text-dark-graphite">
          {formatCurrency(section.total)}
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="py-1 px-1">
              {section.categories.length === 0 ? (
                <div className="px-4 py-4 text-caption text-mid-gray text-center">
                  Sin movimientos en este período
                </div>
              ) : (
                section.categories.map((item) => (
                  <DetailRow key={item.category} item={item} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SubtotalRow({
  label,
  value,
  margin,
  variant = 'default',
}: {
  label: string
  value: number
  margin?: number
  variant?: 'default' | 'highlight'
}) {
  const isPositive = value >= 0

  return (
    <div
      className={`rounded-xl px-5 py-4 flex items-center justify-between ${
        variant === 'highlight'
          ? 'bg-surface card-elevated'
          : 'bg-bone/50 border border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`text-body font-semibold uppercase tracking-wide text-[13px] ${
            variant === 'highlight' ? 'text-dark-graphite' : 'text-graphite'
          }`}
        >
          {label}
        </span>
        {margin !== undefined && (
          <span className="text-caption text-mid-gray bg-surface/80 px-2 py-0.5 rounded-md">
            Margen: {margin.toFixed(1)}%
          </span>
        )}
      </div>
      <span
        className={`font-semibold ${
          variant === 'highlight' ? 'text-kpi' : 'text-body'
        } ${isPositive ? 'text-positive-text' : 'text-negative-text'}`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function IncomeStatementView() {
  const { startDate, endDate } = useDateRange()
  const { statement, loading } = useIncomeStatement(startDate, endDate)

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero" />
      <FinanceTabs />

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-4 gap-4 mb-6"
          >
            <KPICard
              label="Ingresos"
              value={statement.revenue.total + statement.otherIncome.total}
              format="currency"
              trend="up"
              icon={DollarSign}
            />
            <KPICard
              label="Utilidad Bruta"
              value={statement.grossProfit}
              format="currency"
              trend={statement.grossProfit >= 0 ? 'up' : 'down'}
              change={`Margen ${statement.grossMargin.toFixed(1)}%`}
              icon={BarChart3}
            />
            <KPICard
              label="Utilidad Operacional"
              value={statement.operatingProfit}
              format="currency"
              trend={statement.operatingProfit >= 0 ? 'up' : 'down'}
              change={`Margen ${statement.operatingMargin.toFixed(1)}%`}
              icon={TrendingUp}
            />
            <KPICard
              label="Utilidad Neta"
              value={statement.netProfit}
              format="currency"
              trend={statement.netProfit >= 0 ? 'up' : 'down'}
              change={`Margen ${statement.netMargin.toFixed(1)}%`}
              icon={statement.netProfit >= 0 ? TrendingUp : TrendingDown}
            />
          </motion.div>

          {/* Estado de Resultados estructurado */}
          <div className="flex flex-col gap-3">
            {/* Ingresos Operacionales */}
            <StatementSection section={statement.revenue} />

            {/* Costo de Ventas */}
            <StatementSection section={statement.costOfSales} />

            {/* = Utilidad Bruta */}
            <SubtotalRow
              label="Utilidad Bruta"
              value={statement.grossProfit}
              margin={statement.grossMargin}
            />

            {/* Gastos Operacionales */}
            <StatementSection section={statement.operatingExpenses} />

            {/* = Utilidad Operacional */}
            <SubtotalRow
              label="Utilidad Operacional"
              value={statement.operatingProfit}
              margin={statement.operatingMargin}
            />

            {/* Otros Ingresos */}
            <StatementSection section={statement.otherIncome} />

            {/* Otros Gastos */}
            <StatementSection section={statement.otherExpenses} />

            {/* = Utilidad Neta */}
            <SubtotalRow
              label="Utilidad Neta"
              value={statement.netProfit}
              margin={statement.netMargin}
              variant="highlight"
            />
          </div>

          {/* Resumen del período */}
          {statement.transactionCount === 0 && (
            <div className="text-center py-8 text-caption text-mid-gray mt-4">
              No hay transacciones registradas en este período
            </div>
          )}
        </>
      )}
    </PageTransition>
  )
}
