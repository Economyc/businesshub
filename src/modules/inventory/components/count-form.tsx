import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { SelectInput } from '@/core/ui/select-input'
import { SearchInput } from '@/core/ui/search-input'
import { modalVariants } from '@/core/animations/variants'
import { useAuth } from '@/core/hooks/use-auth'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useCountMutations } from '../hooks/use-counts'
import { getTodayStr } from '@/modules/pos-sync/cache-service'
import type { InventoryCount, InventoryCountFormData, InventoryCountLine } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

const STATUS_OPTIONS = [
  { value: 'final', label: 'Final (ancla el stock)' },
  { value: 'draft', label: 'Borrador (en progreso)' },
]

interface CountFormProps {
  open: boolean
  onClose: () => void
  /** Conteo a editar; ausente/null = crear nuevo. */
  count?: InventoryCount | null
}

/** Formatea un Timestamp de Firestore a 'YYYY-MM-DD' en hora local (para el input date). */
function tsToDateInput(ts: Timestamp): string {
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function CountForm({ open, onClose, count }: CountFormProps) {
  const { user } = useAuth()
  const { data: items } = useInventoryItems()
  const { create, update } = useCountMutations()

  const [countedAt, setCountedAt] = useState(getTodayStr())
  const [status, setStatus] = useState<'draft' | 'final'>('final')
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const isEdit = !!count
  const pending = create.isPending || update.isPending

  const activeItems = useMemo(
    () => [...items].filter((i) => i.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [items],
  )

  useEffect(() => {
    if (!open) return
    setSearch('')
    if (count) {
      setCountedAt(tsToDateInput(count.countedAt))
      setStatus(count.status)
      const map: Record<string, string> = {}
      for (const line of count.lines) map[line.itemId] = String(line.qty)
      setQtyByItem(map)
    } else {
      setCountedAt(getTodayStr())
      setStatus('final')
      setQtyByItem({})
    }
  }, [open, count])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeItems
    return activeItems.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q),
    )
  }, [activeItems, search])

  const countedLines = Object.values(qtyByItem).filter((v) => Number(v) > 0).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    // Solo insumos con qty > 0. Un insumo ausente = "no contado" → computeStock lo
    // trata como anchor 0 vía `?? 0`. T12:00:00 evita corrimiento de día por timezone.
    const lines: InventoryCountLine[] = activeItems
      .map((i) => ({ itemId: i.id, qty: Number(qtyByItem[i.id]) }))
      .filter((l) => Number.isFinite(l.qty) && l.qty > 0)

    const data: InventoryCountFormData = {
      countedAt: Timestamp.fromDate(new Date(`${countedAt}T12:00:00`)),
      countedBy: user?.email ?? '',
      lines,
      status,
    }

    if (isEdit && count) {
      await update.mutateAsync({ id: count.id, data })
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
            className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-border max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <h2 className="text-subheading font-semibold text-dark-graphite">
                {isEdit ? 'Editar conteo' : 'Nuevo conteo'}
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
                    <label className={labelClass}>Fecha del conteo</label>
                    <input
                      type="date"
                      value={countedAt}
                      onChange={(e) => setCountedAt(e.target.value)}
                      max={getTodayStr()}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <SelectInput
                      value={status}
                      onChange={(v) => setStatus(v as 'draft' | 'final')}
                      options={STATUS_OPTIONS}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass + ' mb-0'}>Insumos contados</label>
                    <span className="text-caption text-mid-gray">{countedLines} con cantidad</span>
                  </div>
                  {activeItems.length > 6 && (
                    <div className="mb-3">
                      <SearchInput value={search} onChange={setSearch} placeholder="Buscar insumo..." />
                    </div>
                  )}
                  {activeItems.length === 0 ? (
                    <p className="text-body text-mid-gray py-4 text-center">
                      No hay insumos activos. Crea insumos en la pestaña Insumos antes de hacer un conteo.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border/60 divide-y divide-border/60 max-h-[40vh] overflow-y-auto">
                      {filteredItems.map((i) => (
                        <div key={i.id} className="flex items-center gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-body text-dark-graphite truncate">{i.name}</div>
                            {i.category && <div className="text-caption text-mid-gray truncate">{i.category}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              value={qtyByItem[i.id] ?? ''}
                              onChange={(e) => setQtyByItem((prev) => ({ ...prev, [i.id]: e.target.value }))}
                              placeholder="0"
                              className="w-24 px-3 py-2 rounded-lg border border-input-border bg-input-bg text-body text-graphite text-right placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
                            />
                            <span className="text-caption text-mid-gray w-12 shrink-0">{i.stockUnit}</span>
                          </div>
                        </div>
                      ))}
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
                  {pending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar conteo'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
