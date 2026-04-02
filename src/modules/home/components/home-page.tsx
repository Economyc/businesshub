import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, DollarSign, CreditCard, TrendingUp, TrendingDown, Percent, Users, Briefcase, Clock } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateRangePicker } from '@/modules/finance/components/date-range-picker'
import { staggerContainer, staggerItem } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'
import { formatCurrency, formatPercentChange } from '@/core/utils/format'
import { useCompanySummaries, type CompanySummary } from '../hooks'
import { cn } from '@/lib/utils'

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const isUp = value >= 0
  return (
    <span className={cn(
      'ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
      isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
    )}>
      {formatPercentChange(value)}
    </span>
  )
}

function MarginColor(margin: number): string {
  if (margin >= 10) return 'text-emerald-600'
  if (margin >= 5) return 'text-amber-500'
  return 'text-red-500'
}

function CompanyCard({ summary, onClick }: { summary: CompanySummary; onClick: () => void }) {
  const {
    company, monthlyIncome, monthlyExpenses, monthlyNetProfit, profitMargin,
    incomeChange, expenseChange, profitChange,
    activeEmployees, activeSuppliers, pendingNet,
  } = summary
  const isProfitable = monthlyNetProfit >= 0

  return (
    <motion.button
      variants={staggerItem}
      onClick={onClick}
      className="w-full text-left bg-surface rounded-xl card-elevated p-5 hover:shadow-md hover:border-graphite/20 transition-all duration-200 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <CompanyLogo company={company} size="md" />
            <div className="min-w-0">
              <h3 className="text-subheading font-medium text-dark-graphite truncate">{company.name}</h3>
              {company.location && (
                <div className="flex items-center gap-1 text-[11px] text-mid-gray">
                  <MapPin size={10} />
                  <span className="truncate">{company.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]',
          isProfitable ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        )}>
          {isProfitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isProfitable ? 'Rentable' : 'En pérdida'}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ingresos del Mes */}
        <div className="bg-bone/50 rounded-lg px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-mid-gray mb-1">
            <DollarSign size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wide truncate">Ingresos</span>
            <ChangeBadge value={incomeChange} />
          </div>
          <div className="text-sm font-semibold text-emerald-600 truncate">{formatCurrency(monthlyIncome)}</div>
        </div>

        {/* Gastos del Mes */}
        <div className="bg-bone/50 rounded-lg px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-mid-gray mb-1">
            <CreditCard size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wide truncate">Gastos</span>
            <ChangeBadge value={expenseChange} />
          </div>
          <div className="text-sm font-semibold text-red-500 truncate">{formatCurrency(monthlyExpenses)}</div>
        </div>

        {/* Utilidad Neta */}
        <div className="bg-bone/50 rounded-lg px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-mid-gray mb-1">
            {isProfitable ? <TrendingUp size={12} className="shrink-0" /> : <TrendingDown size={12} className="shrink-0" />}
            <span className="text-[11px] uppercase tracking-wide truncate">Utilidad</span>
            <ChangeBadge value={profitChange} />
          </div>
          <div className={cn(
            'text-sm font-semibold truncate',
            isProfitable ? 'text-emerald-600' : 'text-red-500'
          )}>
            {formatCurrency(monthlyNetProfit)}
          </div>
        </div>

        {/* Margen Neto % */}
        <div className="bg-bone/50 rounded-lg px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-mid-gray mb-1">
            <Percent size={12} className="shrink-0" />
            <span className="text-[11px] uppercase tracking-wide truncate">Margen Neto</span>
          </div>
          <div className={cn('text-sm font-semibold truncate', MarginColor(profitMargin))}>
            {profitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2 text-[11px] text-mid-gray min-w-0">
        <span className="flex items-center gap-1 truncate">
          <Users size={10} className="shrink-0" />
          <span className="font-medium text-dark-graphite">{activeEmployees}</span>
        </span>
        <span className="text-border shrink-0">|</span>
        <span className="flex items-center gap-1 truncate">
          <Briefcase size={10} className="shrink-0" />
          <span className="font-medium text-dark-graphite">{activeSuppliers}</span>
        </span>
        <span className="text-border shrink-0">|</span>
        <span className="flex items-center gap-1 truncate">
          <Clock size={10} className="shrink-0" />
          Pend: <span className={cn('font-medium', pendingNet >= 0 ? 'text-blue-500' : 'text-amber-500')}>{formatCurrency(pendingNet)}</span>
        </span>
      </div>
    </motion.button>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const { selectCompany } = useCompany()
  const { summaries, loading } = useCompanySummaries()

  function handleCardClick(summary: CompanySummary) {
    selectCompany(summary.company)
    navigate('/analytics')
  }

  return (
    <PageTransition>
      <PageHeader title="Home">
        <DateRangePicker />
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="text-mid-gray text-caption animate-pulse">Cargando resumen...</span>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {summaries.map((summary) => (
            <CompanyCard
              key={summary.company.id}
              summary={summary}
              onClick={() => handleCardClick(summary)}
            />
          ))}
        </motion.div>
      )}
    </PageTransition>
  )
}
