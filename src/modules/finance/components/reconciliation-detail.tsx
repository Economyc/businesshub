import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Zap, Check, X, Search } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { TableSkeleton } from '@/core/ui/skeleton'
import { HoverHint } from '@/components/ui/tooltip'
import { formatCurrency } from '@/core/utils/format'
import { useCompany } from '@/core/hooks/use-company'
import { useReconciliation } from '../hooks'
import { financeService } from '../services'
import { getCandidatesForEntry } from '../utils/reconciliation-matcher'
import { DiscrepancyReport } from './discrepancy-report'
import {
  RECONCILIATION_STATUS_LABELS,
  RECONCILIATION_STATUS_COLORS,
  type BankEntry,
} from '../types'

type FilterTab = 'all' | 'matched' | 'unmatched'

export function ReconciliationDetail() {
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const {
    statement,
    transactions,
    txMap,
    loading,
    runAutoMatch,
    addManualMatch,
    removeMatch,
  } = useReconciliation(id)

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchLeft, setSearchLeft] = useState('')
  const [searchRight, setSearchRight] = useState('')
  const [autoMatching, setAutoMatching] = useState(false)

  // Match lookups
  const matchByBankId = useMemo(() => {
    if (!statement) return new Map()
    const map = new Map<string, string>()
    for (const m of statement.matches) map.set(m.bankEntryId, m.transactionId)
    return map
  }, [statement])

  const matchByTxId = useMemo(() => {
    if (!statement) return new Map()
    const map = new Map<string, string>()
    for (const m of statement.matches) map.set(m.transactionId, m.bankEntryId)
    return map
  }, [statement])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!statement) return []
    let entries = statement.entries
    if (filterTab === 'matched') entries = entries.filter((e) => matchByBankId.has(e.id))
    if (filterTab === 'unmatched') entries = entries.filter((e) => !matchByBankId.has(e.id))
    if (searchLeft) {
      const q = searchLeft.toLowerCase()
      entries = entries.filter((e) => e.description.toLowerCase().includes(q) || e.date.includes(q))
    }
    return entries
  }, [statement, filterTab, matchByBankId, searchLeft])

  // Right panel: candidates or all unmatched txs
  const rightPanelTxs = useMemo(() => {
    if (!statement || !selectedEntryId) return []
    const entry = statement.entries.find((e) => e.id === selectedEntryId)
    if (!entry) return []

    // If this entry is already matched, show only the matched tx
    const matchedTxId = matchByBankId.get(entry.id)
    if (matchedTxId) {
      const tx = txMap.get(matchedTxId)
      return tx ? [{ tx, score: 100 }] : []
    }

    // Get candidates
    const candidates = getCandidatesForEntry(entry, transactions, statement.matches)
    return candidates
      .map((c) => ({ tx: txMap.get(c.transactionId)!, score: c.score }))
      .filter((c) => c.tx)
  }, [statement, selectedEntryId, matchByBankId, transactions, txMap])

  // Filtered right panel with search
  const filteredRight = useMemo(() => {
    if (!searchRight) return rightPanelTxs
    const q = searchRight.toLowerCase()
    return rightPanelTxs.filter((c) =>
      c.tx.concept.toLowerCase().includes(q) ||
      c.tx.category.toLowerCase().includes(q),
    )
  }, [rightPanelTxs, searchRight])

  async function handleAutoMatch() {
    setAutoMatching(true)
    await runAutoMatch()
    setAutoMatching(false)
  }

  async function handleMatch(txId: string) {
    if (!selectedEntryId) return
    await addManualMatch(selectedEntryId, txId)
    setSelectedEntryId(null)
  }

  async function handleUnmatch(bankEntryId: string) {
    await removeMatch(bankEntryId)
  }

  const handleCreateTransaction = useCallback(async (entry: BankEntry) => {
    if (!selectedCompany) return
    await financeService.create(selectedCompany.id, {
      concept: entry.description,
      category: 'General',
      amount: entry.amount,
      type: entry.type === 'credit' ? 'income' : 'expense',
      date: Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
      status: 'paid',
      notes: `Creado desde extracto bancario${entry.reference ? ` — Ref: ${entry.reference}` : ''}`,
      sourceType: undefined,
      sourceId: undefined,
      sourceLabel: undefined,
    })
  }, [selectedCompany])

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6"><TableSkeleton rows={8} columns={4} /></div>
      </PageTransition>
    )
  }

  if (!statement) {
    return (
      <PageTransition>
        <div className="p-6 text-center text-mid-gray">Extracto no encontrado.</div>
      </PageTransition>
    )
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: statement.entryCount },
    { key: 'matched', label: 'Conciliados', count: statement.matchedCount },
    { key: 'unmatched', label: 'Sin conciliar', count: statement.unmatchedBankCount },
  ]

  return (
    <PageTransition>
      <PageHeader
        title={statement.fileName}
        backTo="/finance/reconciliation"
        subtitle={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-caption font-medium ${RECONCILIATION_STATUS_COLORS[statement.status]}`}>
              {RECONCILIATION_STATUS_LABELS[statement.status]}
            </span>
            <span className="text-caption text-mid-gray">{statement.periodStart} a {statement.periodEnd}</span>
            {statement.bankName && <span className="text-caption text-mid-gray">— {statement.bankName}</span>}
          </div>
        }
      >
        <button
          onClick={handleAutoMatch}
          disabled={autoMatching}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all disabled:opacity-60"
        >
          <Zap size={14} strokeWidth={1.5} />
          {autoMatching ? 'Conciliando...' : 'Auto-conciliar'}
        </button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Movimientos', value: statement.entryCount },
          { label: 'Conciliados', value: statement.matchedCount, color: 'text-emerald-600' },
          { label: 'Sin conciliar (banco)', value: statement.unmatchedBankCount, color: statement.unmatchedBankCount > 0 ? 'text-amber-600' : undefined },
          { label: 'Sin contraparte (sistema)', value: statement.unmatchedTransactionCount },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="text-caption text-mid-gray">{kpi.label}</div>
            <div className={`text-subheading font-semibold mt-1 ${kpi.color ?? 'text-dark-graphite'}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-4 py-2.5 text-body font-medium transition-colors border-b-2 -mb-px ${
              filterTab === tab.key
                ? 'text-dark-graphite border-graphite'
                : 'text-mid-gray border-transparent hover:text-graphite'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Left: Bank entries */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-card-bg/50 px-4 py-3 border-b border-border">
            <h3 className="text-caption font-semibold text-dark-graphite uppercase tracking-wider mb-2">Extracto Bancario</h3>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mid-gray/50" />
              <input
                value={searchLeft}
                onChange={(e) => setSearchLeft(e.target.value)}
                placeholder="Buscar movimiento..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-input-border bg-input-bg text-caption text-graphite placeholder:text-mid-gray/50 focus:border-input-focus outline-none"
              />
            </div>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
            {filteredEntries.length === 0 ? (
              <div className="px-4 py-8 text-center text-caption text-mid-gray">Sin movimientos</div>
            ) : (
              filteredEntries.map((entry) => {
                const isMatched = matchByBankId.has(entry.id)
                const isSelected = selectedEntryId === entry.id
                const matchedTx = isMatched ? txMap.get(matchByBankId.get(entry.id)!) : undefined

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntryId(isSelected ? null : entry.id)}
                    className={`px-4 py-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-graphite/5 border-l-2 border-l-graphite'
                        : isMatched
                          ? 'bg-emerald-50/50 hover:bg-emerald-50'
                          : 'hover:bg-card-bg'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isMatched && <Check size={14} className="text-emerald-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-body text-dark-graphite truncate">{entry.description}</div>
                          <div className="text-caption text-mid-gray">{entry.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-body font-medium ${entry.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                        </span>
                        {isMatched && (
                          <HoverHint label="Deshacer conciliacion">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnmatch(entry.id) }}
                              className="p-1 rounded text-mid-gray/50 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X size={12} strokeWidth={2} />
                            </button>
                          </HoverHint>
                        )}
                      </div>
                    </div>
                    {isMatched && matchedTx && (
                      <div className="mt-1 text-[11px] text-emerald-600/80 truncate pl-6">
                        ↔ {matchedTx.concept} — {matchedTx.category}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right: Transactions / Candidates */}
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-card-bg/50 px-4 py-3 border-b border-border">
            <h3 className="text-caption font-semibold text-dark-graphite uppercase tracking-wider mb-2">
              {selectedEntryId ? 'Candidatos para conciliar' : 'Selecciona un movimiento bancario'}
            </h3>
            {selectedEntryId && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mid-gray/50" />
                <input
                  value={searchRight}
                  onChange={(e) => setSearchRight(e.target.value)}
                  placeholder="Buscar transaccion..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-input-border bg-input-bg text-caption text-graphite placeholder:text-mid-gray/50 focus:border-input-focus outline-none"
                />
              </div>
            )}
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-border/50">
            {!selectedEntryId ? (
              <div className="px-4 py-16 text-center text-caption text-mid-gray">
                Haz clic en un movimiento bancario para ver candidatos de conciliacion
              </div>
            ) : filteredRight.length === 0 ? (
              <div className="px-4 py-8 text-center text-caption text-mid-gray">
                No se encontraron candidatos para este movimiento
              </div>
            ) : (
              filteredRight.map(({ tx, score }) => {
                const isAlreadyMatched = matchByTxId.has(tx.id)
                const txDate = tx.date?.toDate?.()

                return (
                  <div
                    key={tx.id}
                    onClick={() => !isAlreadyMatched && handleMatch(tx.id)}
                    className={`px-4 py-2.5 transition-all ${
                      isAlreadyMatched
                        ? 'bg-emerald-50/50 cursor-default'
                        : 'hover:bg-graphite/5 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isAlreadyMatched && <Check size={14} className="text-emerald-500 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-body text-dark-graphite truncate">{tx.concept}</div>
                          <div className="text-caption text-mid-gray">
                            {txDate?.toLocaleDateString('es-CO')} — {tx.category}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {!isAlreadyMatched && score > 0 && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            score >= 80 ? 'bg-emerald-50 text-emerald-700' :
                            score >= 50 ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {score}%
                          </span>
                        )}
                        <span className={`text-body font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Discrepancy Report */}
      <div className="mb-6">
        <h2 className="text-subheading font-semibold text-dark-graphite mb-4">Reporte de Diferencias</h2>
        <DiscrepancyReport
          statement={statement}
          transactions={transactions}
          onCreateTransaction={handleCreateTransaction}
        />
      </div>
    </PageTransition>
  )
}
