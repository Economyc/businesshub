import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
  Trash2,
  Save,
  X,
} from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { KPICard } from '@/core/ui/kpi-card'
import { CategorySelect } from '@/core/ui/category-select'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { staggerContainer } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useBudgetComparison } from '../hooks'
import { useDateRange } from '../context/date-range-context'
import { FinanceTabs } from './finance-tabs'
import type { BudgetItem } from '../types'
import type { BudgetComparisonRow } from '../hooks'

function ProgressBar({ value, type }: { value: number; type: 'income' | 'expense' }) {
  const capped = Math.min(value, 150)
  const isOver = type === 'expense' ? value > 100 : false
  const isUnder = type === 'income' ? value < 100 && value > 0 : false

  let barColor = 'bg-positive-text'
  if (type === 'expense') {
    if (value > 100) barColor = 'bg-negative-text'
    else if (value > 85) barColor = 'bg-warning-text'
    else barColor = 'bg-positive-text'
  } else {
    if (value >= 100) barColor = 'bg-positive-text'
    else if (value >= 70) barColor = 'bg-warning-text'
    else barColor = 'bg-mid-gray'
  }

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-bone rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(capped, 100) * 100 / (capped > 100 ? capped : 100)}%` }}
        />
      </div>
      <span className={`text-caption font-medium min-w-[42px] text-right ${
        isOver ? 'text-negative-text' : isUnder ? 'text-warning-text' : 'text-mid-gray'
      }`}>
        {value.toFixed(0)}%
      </span>
    </div>
  )
}

function ComparisonRow({ row }: { row: BudgetComparisonRow }) {
  const isPositiveDiff = row.difference >= 0

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_140px] items-center px-4 py-3 hover:bg-bone/30 transition-colors duration-150 rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${row.type === 'income' ? 'bg-positive-text' : 'bg-mid-gray'}`} />
        <span className="text-body text-graphite">{row.category}</span>
      </div>
      <span className="text-body text-mid-gray text-right">{formatCurrency(row.budgeted)}</span>
      <span className="text-body font-medium text-dark-graphite text-right">{formatCurrency(row.actual)}</span>
      <span className={`text-body font-medium text-right ${isPositiveDiff ? 'text-positive-text' : 'text-negative-text'}`}>
        {isPositiveDiff ? '+' : ''}{formatCurrency(row.difference)}
      </span>
      <ProgressBar value={row.execution} type={row.type} />
    </div>
  )
}

function TotalRow({
  label,
  budgeted,
  actual,
  type,
}: {
  label: string
  budgeted: number
  actual: number
  type: 'income' | 'expense'
}) {
  const difference = type === 'income' ? actual - budgeted : budgeted - actual
  const execution = budgeted > 0 ? (actual / budgeted) * 100 : 0

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_140px] items-center px-4 py-3 bg-bone/50 rounded-lg">
      <span className="text-body font-semibold text-dark-graphite uppercase text-[13px] tracking-wide">
        {label}
      </span>
      <span className="text-body font-semibold text-mid-gray text-right">{formatCurrency(budgeted)}</span>
      <span className="text-body font-semibold text-dark-graphite text-right">{formatCurrency(actual)}</span>
      <span className={`text-body font-semibold text-right ${difference >= 0 ? 'text-positive-text' : 'text-negative-text'}`}>
        {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
      </span>
      <ProgressBar value={execution} type={type} />
    </div>
  )
}

function BudgetEditor({
  items,
  onSave,
  onClose,
}: {
  items: BudgetItem[]
  onSave: (items: BudgetItem[]) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<BudgetItem[]>(() =>
    items.length > 0 ? [...items] : []
  )
  const [saving, setSaving] = useState(false)

  const addItem = () => {
    setDraft([...draft, { category: '', type: 'expense', amount: 0 }])
  }

  const removeItem = (index: number) => {
    setDraft(draft.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof BudgetItem, value: string | number) => {
    const updated = [...draft]
    updated[index] = { ...updated[index], [field]: value }
    setDraft(updated)
  }

  const handleSave = async () => {
    const valid = draft.filter((d) => d.category && d.amount > 0)
    setSaving(true)
    try {
      await onSave(valid)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface rounded-xl card-elevated p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-body font-semibold text-dark-graphite">Configurar Presupuesto Mensual</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bone text-mid-gray hover:text-graphite transition-colors">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {draft.length === 0 && (
        <div className="text-caption text-mid-gray text-center py-4 mb-3">
          Agrega partidas presupuestales para cada categoría
        </div>
      )}

      <div className="flex flex-col gap-2.5 mb-4">
        {draft.map((item, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center">
            <CategorySelect
              value={item.category}
              onChange={(v) => updateItem(i, 'category', v)}
              placeholder="Categoría..."
            />
            <SelectInput
              value={item.type}
              onChange={(v) => updateItem(i, 'type', v)}
              options={[
                { value: 'income', label: 'Ingreso' },
                { value: 'expense', label: 'Gasto' },
              ]}
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mid-gray text-body">$</span>
              <CurrencyInput
                value={item.amount || ''}
                onChange={(raw) => updateItem(i, 'amount', Number(raw))}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/40 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
              />
            </div>
            <button
              onClick={() => removeItem(i)}
              className="p-2 rounded-lg hover:bg-bone text-mid-gray hover:text-negative-text transition-colors"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={addItem}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-input-border text-body text-graphite hover:bg-bone transition-all duration-200"
        >
          <Plus size={14} strokeWidth={2} />
          Agregar partida
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save size={14} strokeWidth={2} />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

export function BudgetView() {
  const { startDate, endDate } = useDateRange()
  const [editing, setEditing] = useState(false)
  const { comparison, budgetItems, loading, saveBudget, refetchBudget } = useBudgetComparison(startDate, endDate)

  const handleSave = async (items: BudgetItem[]) => {
    await saveBudget(items)
    await refetchBudget()
  }

  const incomeRows = comparison.rows.filter((r) => r.type === 'income')
  const expenseRows = comparison.rows.filter((r) => r.type === 'expense')
  const overallExecution = comparison.totalBudgetedExpenses > 0
    ? (comparison.totalActualExpenses / comparison.totalBudgetedExpenses) * 100
    : 0

  const hasBudget = budgetItems.length > 0

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <button
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        >
          <Target size={15} strokeWidth={2} />
          {editing ? 'Cerrar Editor' : hasBudget ? 'Editar Presupuesto' : 'Crear Presupuesto'}
        </button>
      </PageHeader>
      <FinanceTabs />

      {/* Editor de presupuesto */}
      {editing && (
        <BudgetEditor
          items={budgetItems}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : !hasBudget && comparison.rows.length === 0 ? (
        <div className="text-center py-12">
          <Target size={40} strokeWidth={1} className="mx-auto text-smoke mb-3" />
          <p className="text-body text-mid-gray mb-1">No hay presupuesto configurado</p>
          <p className="text-caption text-mid-gray/70">
            Usa el botón "Crear Presupuesto" para definir tus metas mensuales por categoría
          </p>
        </div>
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
              label="Presupuesto Gastos"
              value={comparison.totalBudgetedExpenses}
              format="currency"
              icon={Target}
            />
            <KPICard
              label="Gasto Real"
              value={comparison.totalActualExpenses}
              format="currency"
              trend={comparison.totalActualExpenses <= comparison.totalBudgetedExpenses ? 'up' : 'down'}
              change={`${overallExecution.toFixed(0)}% ejecutado`}
              icon={BarChart3}
            />
            <KPICard
              label="Balance Presupuestado"
              value={comparison.budgetedBalance}
              format="currency"
              trend={comparison.budgetedBalance >= 0 ? 'up' : 'down'}
              icon={TrendingUp}
            />
            <KPICard
              label="Balance Real"
              value={comparison.actualBalance}
              format="currency"
              trend={comparison.actualBalance >= 0 ? 'up' : 'down'}
              change={comparison.actualBalance >= comparison.budgetedBalance ? 'Sobre meta' : 'Bajo meta'}
              icon={comparison.actualBalance >= comparison.budgetedBalance ? TrendingUp : TrendingDown}
            />
          </motion.div>

          {/* Tabla comparativa */}
          <div className="bg-surface rounded-xl card-elevated overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_140px] items-center px-4 py-3 border-b border-border">
              <span className="text-caption uppercase tracking-wider text-mid-gray font-medium">Categoría</span>
              <span className="text-caption uppercase tracking-wider text-mid-gray font-medium text-right">Presupuesto</span>
              <span className="text-caption uppercase tracking-wider text-mid-gray font-medium text-right">Real</span>
              <span className="text-caption uppercase tracking-wider text-mid-gray font-medium text-right">Diferencia</span>
              <span className="text-caption uppercase tracking-wider text-mid-gray font-medium text-right">Ejecución</span>
            </div>

            <div className="p-2">
              {/* Ingresos */}
              {incomeRows.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-caption uppercase tracking-wider text-positive-text font-semibold text-[11px]">
                      Ingresos
                    </span>
                  </div>
                  {incomeRows.map((row) => (
                    <ComparisonRow key={`${row.category}-${row.type}`} row={row} />
                  ))}
                  <TotalRow
                    label="Total Ingresos"
                    budgeted={comparison.totalBudgetedIncome}
                    actual={comparison.totalActualIncome}
                    type="income"
                  />
                  <div className="h-2" />
                </>
              )}

              {/* Gastos */}
              {expenseRows.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-caption uppercase tracking-wider text-mid-gray font-semibold text-[11px]">
                      Gastos
                    </span>
                  </div>
                  {expenseRows.map((row) => (
                    <ComparisonRow key={`${row.category}-${row.type}`} row={row} />
                  ))}
                  <TotalRow
                    label="Total Gastos"
                    budgeted={comparison.totalBudgetedExpenses}
                    actual={comparison.totalActualExpenses}
                    type="expense"
                  />
                </>
              )}
            </div>

            {/* Balance final */}
            <div className="border-t border-border px-4 py-4 grid grid-cols-[2fr_1fr_1fr_1fr_140px] items-center">
              <span className="text-body font-semibold text-dark-graphite uppercase text-[13px] tracking-wide">
                Balance Neto
              </span>
              <span className={`text-body font-semibold text-right ${comparison.budgetedBalance >= 0 ? 'text-positive-text' : 'text-negative-text'}`}>
                {formatCurrency(comparison.budgetedBalance)}
              </span>
              <span className={`text-body font-semibold text-right ${comparison.actualBalance >= 0 ? 'text-positive-text' : 'text-negative-text'}`}>
                {formatCurrency(comparison.actualBalance)}
              </span>
              <span className={`text-body font-semibold text-right ${comparison.actualBalance >= comparison.budgetedBalance ? 'text-positive-text' : 'text-negative-text'}`}>
                {comparison.actualBalance >= comparison.budgetedBalance ? '+' : ''}
                {formatCurrency(comparison.actualBalance - comparison.budgetedBalance)}
              </span>
              <span />
            </div>
          </div>
        </>
      )}
    </PageTransition>
  )
}
