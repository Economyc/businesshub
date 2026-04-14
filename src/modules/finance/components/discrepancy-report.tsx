import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { formatCurrency } from '@/core/utils/format'
import type { BankStatement, BankEntry, Transaction } from '../types'

interface Props {
  statement: BankStatement
  transactions: Transaction[]
  onCreateTransaction?: (entry: BankEntry) => void
}

export function DiscrepancyReport({ statement, transactions, onCreateTransaction }: Props) {
  const [bankOpen, setBankOpen] = useState(true)
  const [txOpen, setTxOpen] = useState(true)

  const matchedBankIds = new Set(statement.matches.map((m) => m.bankEntryId))
  const matchedTxIds = new Set(statement.matches.map((m) => m.transactionId))

  const unmatchedEntries = statement.entries.filter((e) => !matchedBankIds.has(e.id))
  const unmatchedTxs = transactions.filter((t) => !matchedTxIds.has(t.id))

  // Totals
  const bankTotal = statement.entries.reduce((s, e) => s + (e.type === 'credit' ? e.amount : -e.amount), 0)
  const unmatchedBankTotal = unmatchedEntries.reduce((s, e) => s + (e.type === 'credit' ? e.amount : -e.amount), 0)

  // Period transactions for comparison
  const periodTxs = transactions.filter((t) => {
    const d = t.date?.toDate?.()
    if (!d) return false
    const iso = d.toISOString().slice(0, 10)
    return iso >= statement.periodStart && iso <= statement.periodEnd
  })
  const systemTotal = periodTxs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
  const difference = bankTotal - systemTotal

  if (unmatchedEntries.length === 0 && unmatchedTxs.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-body text-emerald-700 font-medium">Conciliacion completa — todas las partidas coinciden</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card-bg rounded-lg p-3">
          <div className="text-caption text-mid-gray">Total Banco</div>
          <div className="text-body font-semibold text-dark-graphite">{formatCurrency(bankTotal)}</div>
        </div>
        <div className="bg-card-bg rounded-lg p-3">
          <div className="text-caption text-mid-gray">Total Sistema (periodo)</div>
          <div className="text-body font-semibold text-dark-graphite">{formatCurrency(systemTotal)}</div>
        </div>
        <div className="bg-card-bg rounded-lg p-3">
          <div className="text-caption text-mid-gray">Diferencia</div>
          <div className={`text-body font-semibold ${Math.abs(difference) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {formatCurrency(difference)}
          </div>
        </div>
        <div className="bg-card-bg rounded-lg p-3">
          <div className="text-caption text-mid-gray">Sin conciliar (banco)</div>
          <div className="text-body font-semibold text-amber-600">{formatCurrency(unmatchedBankTotal)}</div>
        </div>
      </div>

      {/* Unmatched bank entries */}
      {unmatchedEntries.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setBankOpen(!bankOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card-bg/50 hover:bg-card-bg transition-colors"
          >
            <span className="text-body font-medium text-dark-graphite">
              Movimientos bancarios sin conciliar ({unmatchedEntries.length})
            </span>
            {bankOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {bankOpen && (
            <div className="divide-y divide-border/50">
              {unmatchedEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-dark-graphite truncate">{entry.description}</div>
                    <div className="text-caption text-mid-gray">{entry.date} {entry.reference && `— Ref: ${entry.reference}`}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-body font-medium ${entry.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </span>
                    {onCreateTransaction && (
                      <button
                        onClick={() => onCreateTransaction(entry)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-input-border text-[11px] text-graphite hover:bg-bone transition-colors"
                      >
                        <Plus size={11} strokeWidth={2} />
                        Crear Tx
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unmatched system transactions (limited to period) */}
      {unmatchedTxs.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setTxOpen(!txOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card-bg/50 hover:bg-card-bg transition-colors"
          >
            <span className="text-body font-medium text-dark-graphite">
              Transacciones del sistema sin contraparte bancaria ({unmatchedTxs.length})
            </span>
            {txOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {txOpen && (
            <div className="divide-y divide-border/50">
              {unmatchedTxs.slice(0, 50).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-dark-graphite truncate">{tx.concept}</div>
                    <div className="text-caption text-mid-gray">
                      {tx.date?.toDate?.()?.toLocaleDateString('es-CO')} — {tx.category}
                    </div>
                  </div>
                  <span className={`text-body font-medium shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
              {unmatchedTxs.length > 50 && (
                <div className="px-4 py-2 text-caption text-mid-gray text-center">
                  ... y {unmatchedTxs.length - 50} transacciones mas
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
