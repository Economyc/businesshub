import { useState, useMemo } from 'react'
import { Plus, Repeat, Pause, Play } from 'lucide-react'
import { RecurringForm } from './recurring-form'
import { FinanceSummary } from './finance-summary'
import { FinanceTabs } from './finance-tabs'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { EmptyState } from '@/core/ui/empty-state'
import { HoverHint } from '@/components/ui/tooltip'
import { TableSkeleton } from '@/core/ui/skeleton'
import { SearchInput } from '@/core/ui/search-input'
import { formatCurrency } from '@/core/utils/format'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useRecurringTransactions } from '../hooks'
import { recurringService } from '../recurring-service'

import { DateRangePicker } from './date-range-picker'
import type { RecurringTransaction, RecurrenceFrequency } from '../types'

const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
}

const FREQ_COLORS: Record<RecurrenceFrequency, { bg: string; text: string }> = {
  daily: { bg: 'bg-blue-100', text: 'text-blue-700' },
  weekly: { bg: 'bg-green-100', text: 'text-green-700' },
  monthly: { bg: 'bg-purple-100', text: 'text-purple-700' },
  yearly: { bg: 'bg-orange-100', text: 'text-orange-700' },
}

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function RecurringList() {
  const { selectedCompany } = useCompany()
  const { data: recurring, loading } = useRecurringTransactions()
  const toggleMutation = useFirestoreMutation<{ id: string; isActive: boolean }>('recurring-transactions', (companyId, data) => recurringService.update(companyId, data.id, { isActive: data.isActive }))
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return recurring
    const q = search.toLowerCase()
    return recurring.filter(
      (r) => r.concept.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    )
  }, [recurring, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
      const aNext = a.nextDueDate?.toDate?.()?.getTime() ?? 0
      const bNext = b.nextDueDate?.toDate?.()?.getTime() ?? 0
      return aNext - bNext
    })
  }, [filtered])

  async function toggleActive(rec: RecurringTransaction) {
    if (!selectedCompany) return
    await toggleMutation.mutateAsync({ id: rec.id, isActive: !rec.isActive })
  }

  return (
    <PageTransition>
      <PageHeader title="Monitor Financiero">
        <DateRangePicker />
        <button
          onClick={() => { setEditingId(null); setFormOpen(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
        >
          <Plus size={15} strokeWidth={2} />
          Nueva
        </button>
      </PageHeader>

      <FinanceSummary />
      <FinanceTabs />

      <div className="flex gap-3 mb-5">
        <div className="flex-1 min-w-0 sm:min-w-[180px]">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar recurrente..." />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No hay recurrentes"
          description="Crea una transacción recurrente para automatizar gastos o ingresos fijos"
        />
      ) : (
        <div className="bg-surface rounded-xl card-elevated overflow-hidden overflow-x-auto">
          {/* Header */}
          <div
            className="min-w-[640px] grid px-5 py-2.5 text-caption uppercase tracking-wider text-mid-gray bg-bone/40 border-b border-border"
            style={{ gridTemplateColumns: '2fr 0.8fr 0.8fr 1fr 1fr 0.5fr' }}
          >
            <div className="px-3">Concepto</div>
            <div className="px-3">Frecuencia</div>
            <div className="px-3">Tipo</div>
            <div className="px-3">Monto</div>
            <div className="px-3">Próxima</div>
            <div className="px-3 text-center">Estado</div>
          </div>

          {sorted.map((rec, i) => {
            const freq = FREQ_COLORS[rec.frequency]
            return (
              <div
                key={rec.id}
                className={`min-w-[640px] grid px-5 py-0 text-body hover:bg-bone/50 transition-colors duration-150 ${!rec.isActive ? 'opacity-50' : ''}`}
                style={{
                  gridTemplateColumns: '2fr 0.8fr 0.8fr 1fr 1fr 0.5fr',
                  borderBottom: i < sorted.length - 1 ? '1px solid #e5e4e0' : 'none',
                }}
              >
                <div
                  className="px-3 py-3.5 flex items-center gap-2 cursor-pointer"
                  onClick={() => { setEditingId(rec.id); setFormOpen(true) }}
                >
                  <span className="font-medium text-dark-graphite">{rec.concept}</span>
                  <span className="text-caption text-mid-gray truncate">{rec.category}</span>
                </div>
                <div className="px-3 py-3.5 flex items-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${freq.bg} ${freq.text}`}>
                    {FREQ_LABELS[rec.frequency]}
                  </span>
                </div>
                <div className="px-3 py-3.5 flex items-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${rec.type === 'income' ? 'bg-positive-bg text-positive-text' : 'bg-negative-bg text-negative-text'}`}>
                    {rec.type === 'income' ? 'Ingreso' : 'Gasto'}
                  </span>
                </div>
                <div className="px-3 py-3.5 flex items-center">
                  <span className={rec.type === 'income' ? 'text-positive-text font-medium' : 'text-graphite'}>
                    {rec.type === 'income' ? '+' : '-'}{formatCurrency(rec.amount, 2)}
                  </span>
                </div>
                <div className="px-3 py-3.5 flex items-center text-mid-gray">
                  {formatDate(rec.nextDueDate)}
                </div>
                <div className="px-3 py-3.5 flex items-center justify-center">
                  <HoverHint label={rec.isActive ? 'Pausar' : 'Activar'}>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(rec) }}
                      className={`p-1.5 rounded-lg transition-all duration-150 ${rec.isActive ? 'text-positive-text hover:bg-positive-bg' : 'text-mid-gray hover:bg-bone'}`}
                    >
                      {rec.isActive ? <Play size={15} strokeWidth={2} /> : <Pause size={15} strokeWidth={2} />}
                    </button>
                  </HoverHint>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <RecurringForm
        open={formOpen}
        recurringId={editingId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false) }}
      />
    </PageTransition>
  )
}
