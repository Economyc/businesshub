import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { SelectInput } from '@/core/ui/select-input'
import { modalVariants } from '@/core/animations/variants'
import { useAuth } from '@/core/hooks/use-auth'
import { getTodayStr } from '@/modules/pos-sync/cache-service'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useAdjustmentMutations } from '../hooks/use-adjustments'
import type {
  InventoryAdjustment,
  InventoryAdjustmentLine,
  InventoryAdjustmentFormData,
  AdjustmentType,
} from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

const TYPE_OPTIONS: { value: AdjustmentType; label: string }[] = [
  { value: 'merma', label: 'Merma (se dañó / venció)' },
  { value: 'daño', label: 'Daño (rotura)' },
  { value: 'cortesía', label: 'Cortesía (consumo / regalo)' },
  { value: 'traslado', label: 'Traslado (a otro local)' },
  { value: 'corrección', label: 'Corrección de conteo' },
]

interface WasteFormProps {
  open: boolean
  onClose: () => void
  /** Ajuste a editar; ausente/null = crear nuevo. */
  adjustment?: InventoryAdjustment | null
}

interface LineRow {
  itemId: string
  qty: string
  reason: string
}

const EMPTY_ROW: LineRow = { itemId: '', qty: '', reason: '' }

/** Formatea un Timestamp de Firestore a 'YYYY-MM-DD' en hora local (para el input date). */
function tsToDateInput(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function WasteForm({ open, onClose, adjustment }: WasteFormProps) {
  const { user } = useAuth()
  const { data: items } = useInventoryItems()
  const { create, update } = useAdjustmentMutations()

  const [occurredAt, setOccurredAt] = useState(getTodayStr())
  const [type, setType] = useState<AdjustmentType>('merma')
  const [rows, setRows] = useState<LineRow[]>([{ ...EMPTY_ROW }])

  const isEdit = !!adjustment
  const pending = create.isPending || update.isPending

  const itemsById = useMemo(() => {
    const map: Record<string, (typeof items)[number]> = {}
    for (const it of items) map[it.id] = it
    return map
  }, [items])

  const activeItems = useMemo(
    () => [...items].filter((i) => i.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [items],
  )

  useEffect(() => {
    if (!open) return
    if (adjustment) {
      setOccurredAt(tsToDateInput(adjustment.occurredAt))
      setType(adjustment.type)
      setRows(
        adjustment.lines.length > 0
          ? adjustment.lines.map((l) => ({
              itemId: l.itemId,
              qty: String(l.qtyDelta),
              reason: l.reason ?? '',
            }))
          : [{ ...EMPTY_ROW }],
      )
    } else {
      setOccurredAt(getTodayStr())
      setType('merma')
      setRows([{ ...EMPTY_ROW }])
    }
  }, [open, adjustment])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function setRow(idx: number, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    const lines: InventoryAdjustmentLine[] = rows
      .filter((r) => r.itemId && Number(r.qty) > 0)
      .map((r) => ({
        itemId: r.itemId,
        qtyDelta: Number(r.qty),
        ...(r.reason.trim() ? { reason: r.reason.trim() } : {}),
      }))

    if (lines.length === 0) return

    const data: InventoryAdjustmentFormData = {
      occurredAt: Timestamp.fromDate(new Date(`${occurredAt}T12:00:00`)),
      type,
      lines,
      by: user?.email ?? '',
    }

    if (isEdit && adjustment) {
      await update.mutateAsync({ id: adjustment.id, data })
    } else {
      await create.mutateAsync(data)
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-3xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-subheading font-semibold text-dark-graphite">
                {isEdit ? 'Editar merma' : 'Nueva merma'}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Fecha</label>
                    <input
                      type="date"
                      value={occurredAt}
                      onChange={(e) => setOccurredAt(e.target.value)}
                      max={getTodayStr()}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Motivo</label>
                    <SelectInput
                      value={type}
                      onChange={(v) => setType(v as AdjustmentType)}
                      options={TYPE_OPTIONS}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass + ' mb-0'}>Insumos que salieron</label>
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input-border text-graphite text-caption font-medium hover:bg-bone transition-colors"
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      Agregar insumo
                    </button>
                  </div>

                  {activeItems.length === 0 ? (
                    <p className="text-body text-mid-gray py-4 text-center">
                      No hay insumos activos. Crea insumos en la pestaña Insumos antes de registrar una merma.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((row, idx) => {
                        const chosenElsewhere = new Set(
                          rows.filter((_, i) => i !== idx).map((r) => r.itemId).filter(Boolean),
                        )
                        const itemOptions = activeItems
                          .filter((it) => it.id === row.itemId || !chosenElsewhere.has(it.id))
                          .map((it) => ({ value: it.id, label: it.name }))
                        const item = itemsById[row.itemId]
                        const unitHint = item?.stockUnit ?? 'u.'
                        return (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border/60 p-2"
                          >
                            <div className="col-span-4">
                              <SelectInput
                                value={row.itemId}
                                onChange={(v) => setRow(idx, { itemId: v })}
                                options={itemOptions}
                                placeholder="Insumo..."
                              />
                            </div>
                            <div className="col-span-3">
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  inputMode="decimal"
                                  value={row.qty}
                                  onChange={(e) => setRow(idx, { qty: e.target.value })}
                                  placeholder="Cant."
                                  className={inputClass + ' pr-12'}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-mid-gray pointer-events-none">
                                  {unitHint}
                                </span>
                              </div>
                            </div>
                            <div className="col-span-4">
                              <input
                                value={row.reason}
                                onChange={(e) => setRow(idx, { reason: e.target.value })}
                                placeholder="Nota (opcional)"
                                className={inputClass}
                              />
                            </div>
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-mid-gray hover:bg-negative-bg hover:text-negative-text transition-colors"
                                aria-label="Quitar insumo"
                              >
                                <Trash2 size={15} strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending || activeItems.length === 0}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar merma'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
