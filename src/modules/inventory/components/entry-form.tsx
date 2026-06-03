import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { getTodayStr } from '@/modules/pos-sync/cache-service'
import { useInventoryItems, useInventoryItemMutations } from '../hooks/use-inventory-items'
import { useReceiptMutations } from '../hooks/use-receipts'
import { labelForPurchaseUnit } from '../domain/purchase-units'
import type {
  InventoryReceipt,
  InventoryReceiptLine,
  InventoryReceiptFormData,
  ItemCostChange,
} from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

interface EntryFormProps {
  open: boolean
  onClose: () => void
  /** Entrada a editar; ausente/null = crear nueva. */
  receipt?: InventoryReceipt | null
}

interface LineRow {
  itemId: string
  qty: string
  unitCost: string
}

const EMPTY_ROW: LineRow = { itemId: '', qty: '', unitCost: '' }

/** Formatea un Timestamp de Firestore a 'YYYY-MM-DD' en hora local (para el input date). */
function tsToDateInput(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function EntryForm({ open, onClose, receipt }: EntryFormProps) {
  const { data: items } = useInventoryItems()
  const { data: suppliers } = useSuppliers()
  const { create, update } = useReceiptMutations()
  const { update: updateItem } = useInventoryItemMutations()

  const [receivedAt, setReceivedAt] = useState(getTodayStr())
  const [supplierId, setSupplierId] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [rows, setRows] = useState<LineRow[]>([{ ...EMPTY_ROW }])

  const isEdit = !!receipt
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
    if (receipt) {
      setReceivedAt(tsToDateInput(receipt.receivedAt))
      setSupplierId(receipt.supplierId ?? '')
      setInvoiceRef(receipt.invoiceRef ?? '')
      setRows(
        receipt.lines.length > 0
          ? receipt.lines.map((l) => ({
              itemId: l.itemId,
              qty: String(l.qty),
              unitCost: l.unitCost != null ? String(l.unitCost) : '',
            }))
          : [{ ...EMPTY_ROW }],
      )
    } else {
      setReceivedAt(getTodayStr())
      setSupplierId('')
      setInvoiceRef('')
      setRows([{ ...EMPTY_ROW }])
    }
  }, [open, receipt])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const supplierOptions = useMemo(
    () => [{ value: '', label: 'Sin proveedor' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    [suppliers],
  )

  function setRow(idx: number, patch: Partial<LineRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  /** Costo total estimado de la entrada (Σ qty·unitCost). */
  const total = useMemo(() => {
    let sum = 0
    for (const r of rows) {
      const qty = Number(r.qty)
      const cost = Number(r.unitCost)
      if (qty > 0 && cost > 0) sum += qty * cost
    }
    return sum
  }, [rows])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    const lines: InventoryReceiptLine[] = rows
      .filter((r) => r.itemId && Number(r.qty) > 0)
      .map((r) => {
        const cost = Number(r.unitCost)
        return {
          itemId: r.itemId,
          qty: Number(r.qty),
          ...(cost > 0 ? { unitCost: cost } : {}),
        }
      })

    if (lines.length === 0) return

    const data: InventoryReceiptFormData = {
      receivedAt: Timestamp.fromDate(new Date(`${receivedAt}T12:00:00`)),
      lines,
      ...(supplierId ? { supplierId } : {}),
      ...(invoiceRef.trim() ? { invoiceRef: invoiceRef.trim() } : {}),
    }

    let receiptId: string
    if (isEdit && receipt) {
      await update.mutateAsync({ id: receipt.id, data })
      receiptId = receipt.id
    } else {
      receiptId = (await create.mutateAsync(data)) as string
    }

    // Auto-actualiza el costo del insumo cuando la entrada trae un costo distinto,
    // dejando registro en costHistory. Una línea por insumo (la última gana si se repite).
    const now = Timestamp.now()
    const seen = new Set<string>()
    for (const line of lines) {
      if (line.unitCost == null || seen.has(line.itemId)) continue
      seen.add(line.itemId)
      const item = itemsById[line.itemId]
      if (!item) continue
      const prevCost = item.unitCost ?? 0
      if (line.unitCost === prevCost) continue
      const change: ItemCostChange = {
        at: now,
        previousCost: prevCost,
        newCost: line.unitCost,
        receiptId,
      }
      await updateItem.mutateAsync({
        id: item.id,
        data: { unitCost: line.unitCost, costHistory: [...(item.costHistory ?? []), change] },
      })
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
                {isEdit ? 'Editar entrada' : 'Nueva entrada'}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Fecha de recepción</label>
                    <input
                      type="date"
                      value={receivedAt}
                      onChange={(e) => setReceivedAt(e.target.value)}
                      max={getTodayStr()}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Proveedor</label>
                    <SelectInput
                      value={supplierId}
                      onChange={setSupplierId}
                      options={supplierOptions}
                      placeholder="Sin proveedor"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Ref. factura</label>
                    <input
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass + ' mb-0'}>Insumos recibidos</label>
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
                      No hay insumos activos. Crea insumos en la pestaña Insumos antes de registrar una entrada.
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
                        const unitHint = item ? labelForPurchaseUnit(item.purchaseUnit) : 'unidad'
                        const enteredCost = Number(row.unitCost)
                        const prevCost = item?.unitCost ?? 0
                        const costChanged = !!item && enteredCost > 0 && enteredCost !== prevCost
                        return (
                          <div key={idx} className="rounded-lg border border-border/60 p-2">
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-5">
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
                                    className={inputClass + ' pr-16'}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-mid-gray pointer-events-none max-w-[56px] truncate">
                                    {unitHint}
                                  </span>
                                </div>
                              </div>
                              <div className="col-span-3">
                                <CurrencyInput
                                  value={row.unitCost}
                                  onChange={(raw) => setRow(idx, { unitCost: raw })}
                                  placeholder="Costo"
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
                            {costChanged && (
                              <p className="text-caption text-warning-text mt-1.5 px-1">
                                Actualiza el costo del insumo: {formatCurrency(prevCost)} → {formatCurrency(enteredCost)}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {total > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-bone px-4 py-3">
                    <span className="text-caption uppercase tracking-wider text-mid-gray">Total de la entrada</span>
                    <span className="text-subheading font-semibold text-dark-graphite">{formatCurrency(total)}</span>
                  </div>
                )}
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
                  {pending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar entrada'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
