import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Scale, Trash2 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SearchInput } from '@/core/ui/search-input'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'

import { BankStatementImport } from './bank-statement-import'
import { useBankStatements, useBankStatementDelete } from '../hooks'
import {
  RECONCILIATION_STATUS_LABELS,
  RECONCILIATION_STATUS_COLORS,
  type BankStatement,
} from '../types'

export function ReconciliationView() {
  const { data: statements, loading, refetch } = useBankStatements()
  const deleteMutation = useBankStatementDelete()
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BankStatement | null>(null)

  const sorted = useMemo(() => {
    const list = [...statements].sort((a, b) => (b.periodEnd ?? '').localeCompare(a.periodEnd ?? ''))
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(
      (s) =>
        s.fileName.toLowerCase().includes(q) ||
        (s.bankName ?? '').toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q),
    )
  }, [statements, search])

  // KPI aggregates
  const kpis = useMemo(() => {
    const total = statements.length
    const reconciled = statements.filter((s) => s.status === 'reconciled').length
    const pending = statements.filter((s) => s.status === 'pending').length
    const totalUnmatched = statements.reduce((s, st) => s + st.unmatchedBankCount, 0)
    return { total, reconciled, pending, totalUnmatched }
  }, [statements])

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <PageTransition>
      <PageHeader title="Conciliacion Bancaria">
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
        >
          <Plus size={15} strokeWidth={2} />
          Importar Extracto
        </button>
      </PageHeader>

      <BankStatementImport
        open={showImport}
        onClose={() => { setShowImport(false); refetch() }}
        onImported={(id) => { setShowImport(false); navigate(`/finance/reconciliation/${id}`) }}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Extractos', value: kpis.total },
          { label: 'Conciliados', value: kpis.reconciled },
          { label: 'Pendientes', value: kpis.pending },
          { label: 'Mov. sin conciliar', value: kpis.totalUnmatched },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="text-caption text-mid-gray">{kpi.label}</div>
            <div className="text-subheading font-semibold mt-1 text-dark-graphite">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por archivo o banco..." />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No hay extractos bancarios"
          description="Importa tu primer extracto bancario (CSV u OFX) para iniciar la conciliacion"
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((stmt) => (
            <div
              key={stmt.id}
              className="bg-surface-elevated rounded-xl border border-border p-4 hover:bg-card-bg transition-colors cursor-pointer group"
              onClick={() => navigate(`/finance/reconciliation/${stmt.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-body font-medium text-dark-graphite truncate">{stmt.fileName}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-caption font-medium ${RECONCILIATION_STATUS_COLORS[stmt.status]}`}>
                      {RECONCILIATION_STATUS_LABELS[stmt.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-caption text-mid-gray">
                    {stmt.bankName && <span>{stmt.bankName}</span>}
                    <span>{stmt.periodStart} a {stmt.periodEnd}</span>
                    <span>{stmt.entryCount} movimientos</span>
                    <span className="text-emerald-600">{stmt.matchedCount} conciliados</span>
                    {stmt.unmatchedBankCount > 0 && (
                      <span className="text-amber-600">{stmt.unmatchedBankCount} pendientes</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-dark-graphite">
                    {formatCurrency(stmt.entries.reduce((s, e) => s + (e.type === 'credit' ? e.amount : -e.amount), 0))}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(stmt) }}
                    className="p-1.5 rounded-lg text-mid-gray/0 group-hover:text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar Extracto"
        description={`¿Eliminar "${deleteTarget?.fileName}"? Se perderan todas las conciliaciones asociadas.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  )
}
