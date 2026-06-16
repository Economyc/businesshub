import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, CheckCircle2, Send, Loader2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useAuth } from '@/core/hooks/use-auth'
import { useCompany } from '@/core/hooks/use-company'
import { useProjectedStock } from '../hooks/use-projected-stock'
import { useCountMutations } from '../hooks/use-counts'
import { computeVariance, type VarianceRow } from '../domain/compute-variance'
import { notifyCountDiff } from '../services/notify-count.service'
import type { InventoryCount } from '../types'

interface CountVariancePanelProps {
  open: boolean
  onClose: () => void
  /** Conteo borrador a revisar. */
  count: InventoryCount | null
}

/** Formatea un Timestamp a 'YYYY-MM-DD' en hora local. */
function tsToYMD(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Resultado del envío a Telegram tras aprobar. */
type TelegramOutcome = 'none' | 'sent' | 'not-linked' | 'failed'

function KindChip({ kind }: { kind: VarianceRow['kind'] }) {
  if (kind === 'faltante') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-negative-bg text-negative-text">
        Faltante
      </span>
    )
  }
  if (kind === 'sobrante') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-warning-bg text-warning-text">
        Sobrante
      </span>
    )
  }
  return <span className="text-caption text-mid-gray">Igual</span>
}

export function CountVariancePanel({ open, onClose, count }: CountVariancePanelProps) {
  const { can } = usePermissions()
  const canUpdate = can('inventory', 'update')
  const { user } = useAuth()
  const { selectedCompany } = useCompany()
  const { update } = useCountMutations()

  const { stock, items, lastFinalCount, loading } = useProjectedStock()

  const [showAll, setShowAll] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [telegram, setTelegram] = useState<TelegramOutcome>('none')

  // Primer conteo (no hay final previo) → solo establece la línea base, no hay
  // con qué comparar. El propio draft no cuenta como ancla (lastFinalCount lo excluye).
  const isBaseline = !lastFinalCount

  useEffect(() => {
    if (!open) {
      setShowAll(false)
      setApproving(false)
      setApproved(false)
      setTelegram('none')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !approving) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, approving])

  const variance = useMemo(() => {
    if (!count) return null
    return computeVariance({ items, countLines: count.lines, expectedStock: stock })
  }, [count, items, stock])

  const visibleRows = useMemo(() => {
    if (!variance) return []
    if (showAll) return variance.rows
    return variance.rows.filter((r) => r.kind !== 'igual')
  }, [variance, showAll])

  async function handleApprove() {
    if (!count || approving) return
    setApproving(true)
    try {
      await update.mutateAsync({ id: count.id, data: { status: 'final' } })
      setApproved(true)

      // Notificar a Telegram solo si hay diferencias reales y no es la línea base.
      if (!isBaseline && variance?.hasDifferences && selectedCompany) {
        const diffLines = variance.rows
          .filter((r) => r.kind !== 'igual')
          .map((r) => ({
            name: r.name,
            unit: r.unit,
            expected: r.expected,
            counted: r.counted,
            diff: r.diff,
            diffValue: r.diffValue,
          }))
        // Inventario completo (todas las filas) para el PDF + CSV adjuntos.
        const allLines = variance.rows.map((r) => ({
          name: r.name,
          unit: r.unit,
          category: r.category,
          expected: r.expected,
          counted: r.counted,
          diff: r.diff,
          diffValue: r.diffValue,
        }))
        try {
          const res = await notifyCountDiff({
            companyId: selectedCompany.id,
            countDate: tsToYMD(count.countedAt),
            approvedBy: user?.email ?? count.countedBy ?? '',
            companyName: selectedCompany.name,
            currency: 'COP',
            lines: diffLines,
            allLines,
            totals: variance.totals,
          })
          setTelegram(res.ok ? 'sent' : res.reason === 'not-linked' ? 'not-linked' : 'failed')
        } catch {
          setTelegram('failed')
        }
      }
    } catch {
      // Falló la actualización del conteo: dejar el panel abierto para reintentar.
      setApproving(false)
      return
    }
    setApproving(false)
  }

  const totals = variance?.totals

  return (
    <AnimatePresence>
      {open && count && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={approving ? undefined : onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-subheading font-semibold text-dark-graphite">Diferencias del conteo</h2>
                <p className="text-caption text-mid-gray">
                  {count.countedAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={approving}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors disabled:opacity-50"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {loading ? (
                <div className="flex items-center gap-2 text-body text-mid-gray py-8 justify-center">
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                  Calculando diferencias…
                </div>
              ) : isBaseline ? (
                <div className="rounded-lg bg-info-bg px-4 py-3 text-body text-info-text">
                  Este es el primer conteo final: establece la línea base del stock. No hay un conteo
                  anterior con qué comparar, así que no se reportan diferencias.
                </div>
              ) : (
                <>
                  {/* Resumen de totales */}
                  {totals && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border/60 p-3">
                        <div className="text-caption uppercase tracking-wider font-semibold text-mid-gray">Faltante</div>
                        <div className="text-subheading font-semibold text-negative-text mt-0.5">
                          {formatCurrency(totals.shortageValue)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3">
                        <div className="text-caption uppercase tracking-wider font-semibold text-mid-gray">Sobrante</div>
                        <div className="text-subheading font-semibold text-warning-text mt-0.5">
                          {formatCurrency(totals.overageValue)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3">
                        <div className="text-caption uppercase tracking-wider font-semibold text-mid-gray">Neto</div>
                        <div className="text-subheading font-semibold text-dark-graphite mt-0.5">
                          {formatCurrency(totals.netValue)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Banner de insumos sin contar */}
                  {variance && variance.notCountedCount > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-4 py-3 text-body text-warning-text">
                      <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                      <span>
                        {variance.notCountedCount}{' '}
                        {variance.notCountedCount === 1 ? 'insumo activo sin contar' : 'insumos activos sin contar'}.
                        Si apruebas, su stock arrancará en 0. Volvé al borrador para completarlos si hace falta.
                      </span>
                    </div>
                  )}

                  {/* Tabla de diferencias */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-caption uppercase tracking-wider font-semibold text-mid-gray">
                        {totals?.itemsWithDiff ?? 0} de {variance?.rows.length ?? 0} insumos con diferencia
                      </span>
                      <button
                        onClick={() => setShowAll((v) => !v)}
                        className="text-caption text-graphite font-medium hover:underline"
                      >
                        {showAll ? 'Solo diferencias' : 'Ver todos'}
                      </button>
                    </div>

                    {visibleRows.length === 0 ? (
                      <p className="text-body text-mid-gray py-6 text-center">
                        No hay diferencias respecto al stock esperado.
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border/60 divide-y divide-border/60 max-h-[40vh] overflow-y-auto">
                        {visibleRows.map((r) => (
                          <div key={r.itemId} className="flex items-center gap-3 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-body text-dark-graphite truncate">{r.name}</div>
                              <div className="text-caption text-mid-gray truncate">
                                Esperado {r.expected.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ·
                                Contado {r.notCounted ? '—' : r.counted.toLocaleString('es-CO', { maximumFractionDigits: 1 })} {r.unit}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div
                                  className={`text-body font-medium ${
                                    r.kind === 'faltante'
                                      ? 'text-negative-text'
                                      : r.kind === 'sobrante'
                                        ? 'text-warning-text'
                                        : 'text-graphite'
                                  }`}
                                >
                                  {r.diff > 0 ? '+' : ''}
                                  {r.diff.toLocaleString('es-CO', { maximumFractionDigits: 1 })} {r.unit}
                                </div>
                                {r.diffValue != null && (
                                  <div className="text-caption text-mid-gray">
                                    {r.diff > 0 ? '+' : ''}
                                    {formatCurrency(r.diffValue)}
                                  </div>
                                )}
                              </div>
                              <KindChip kind={r.kind} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Resultado de la aprobación */}
              {approved && (
                <div className="flex items-start gap-2 rounded-lg bg-positive-bg px-4 py-3 text-body text-positive-text">
                  <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div>Conteo aprobado. El stock se actualizó a las cantidades contadas.</div>
                    {telegram === 'sent' && (
                      <div className="flex items-center gap-1.5 text-caption">
                        <Send size={12} strokeWidth={1.5} /> Reporte enviado a tu Telegram.
                      </div>
                    )}
                    {telegram === 'not-linked' && (
                      <div className="text-caption">Vinculá tu Telegram para recibir el reporte de diferencias.</div>
                    )}
                    {telegram === 'failed' && (
                      <div className="text-caption">No se pudo enviar la notificación a Telegram.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
              {approved ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
                >
                  Cerrar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={approving}
                    className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone disabled:opacity-50"
                  >
                    Seguir en borrador
                  </button>
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approving || loading}
                      className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {approving && <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />}
                      {approving ? 'Aprobando…' : 'Aprobar y actualizar inventario'}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
