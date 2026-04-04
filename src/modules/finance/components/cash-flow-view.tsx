import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight as ChevronClosed, Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, AlertCircle } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { DashboardSkeleton } from '@/core/ui/skeleton'
import { useCashFlow } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { FinanceTabs } from './finance-tabs'
import { DateRangePicker } from './date-range-picker'
import type { CategoryBreakdown } from '../hooks'

function CategoryRow({ item, type }: { item: CategoryBreakdown; type: 'income' | 'expense' }) {
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
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bone/50 transition-colors duration-150 rounded-lg group"
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
        <span className={`text-body font-medium ${type === 'income' ? 'text-positive-text' : 'text-dark-graphite'}`}>
          {type === 'income' ? '+' : '-'} {formatCurrency(item.total)}
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
                    <span className={`text-caption font-medium ${type === 'income' ? 'text-positive-text' : 'text-dark-graphite'}`}>
                      {type === 'income' ? '+' : '-'} {formatCurrency(group.total)}
                    </span>
                  </button>

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

function SectionBlock({
  title,
  items,
  total,
  type,
}: {
  title: string
  items: CategoryBreakdown[]
  total: number
  type: 'income' | 'expense'
}) {
  const [collapsed, setCollapsed] = useState(false)

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
            {title}
          </span>
        </div>
        <span className={`text-body font-semibold ${type === 'income' ? 'text-positive-text' : 'text-dark-graphite'}`}>
          {type === 'income' ? '+' : '-'} {formatCurrency(total)}
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
              {items.length === 0 ? (
                <div className="px-4 py-4 text-caption text-mid-gray text-center">
                  Sin movimientos en este período
                </div>
              ) : (
                items.map((item) => (
                  <CategoryRow key={item.category} item={item} type={type} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CashFlowView() {
  const { startDate, endDate } = useDateRange()
  const { cashFlow, loading } = useCashFlow(startDate, endDate)

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
      </PageHeader>
      <FinanceTabs />

      {loading ? (
        <DashboardSkeleton kpiCount={4} charts={1} />
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            <KPICard label="Saldo Inicial" value={cashFlow.openingBalance} format="currency" icon={Wallet} />
            <KPICard label="Entradas" value={cashFlow.totalIncome} format="currency" trend="up" icon={ArrowDownLeft} />
            <KPICard label="Salidas" value={cashFlow.totalExpenses} format="currency" trend="down" icon={ArrowUpRight} />
            <KPICard
              label="Saldo Final"
              value={cashFlow.closingBalance}
              format="currency"
              trend={cashFlow.netFlow >= 0 ? 'up' : 'down'}
              icon={TrendingUp}
            />
          </motion.div>

          {/* Desglose por categoría */}
          <div className="flex flex-col gap-4 mb-5">
            <SectionBlock
              title="Entradas"
              items={cashFlow.incomeByCategory}
              total={cashFlow.totalIncome}
              type="income"
            />
            <SectionBlock
              title="Salidas"
              items={cashFlow.expensesByCategory}
              total={cashFlow.totalExpenses}
              type="expense"
            />
          </div>

          {/* Flujo Neto */}
          <div className="bg-surface rounded-xl card-elevated px-5 py-4 flex items-center justify-between mb-5">
            <span className="text-body font-semibold text-dark-graphite uppercase tracking-wide text-[13px]">
              Flujo Neto del Período
            </span>
            <span
              className={`text-kpi font-semibold ${cashFlow.netFlow >= 0 ? 'text-positive-text' : 'text-negative-text'}`}
            >
              {cashFlow.netFlow >= 0 ? '+' : ''} {formatCurrency(cashFlow.netFlow)}
            </span>
          </div>

          {/* Pendientes / Proyección */}
          {cashFlow.pendingCount > 0 && (
            <div className="flex items-center gap-3 bg-warning-bg border border-warning-text/20 rounded-xl px-5 py-3.5">
              <AlertCircle size={18} className="text-warning-text shrink-0" />
              <div className="text-body text-warning-text">
                <span className="font-medium">{cashFlow.pendingCount} transacción{cashFlow.pendingCount > 1 ? 'es' : ''} pendiente{cashFlow.pendingCount > 1 ? 's' : ''}</span>
                {' '}en este período
                {cashFlow.pendingIncome > 0 && (
                  <span> — por cobrar: <span className="font-medium">{formatCurrency(cashFlow.pendingIncome)}</span></span>
                )}
                {cashFlow.pendingExpenses > 0 && (
                  <span> — por pagar: <span className="font-medium">{formatCurrency(cashFlow.pendingExpenses)}</span></span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PageTransition>
  )
}
