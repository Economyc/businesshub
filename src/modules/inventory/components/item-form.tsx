import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { useInventoryItemMutations } from '../hooks/use-inventory-items'
import { costPerStockUnit } from '../domain/units'
import { PURCHASE_UNITS, getPurchaseUnit, stockUnitLabel } from '../domain/purchase-units'
import type { InventoryItem, InventoryItemFormData, PurchaseUnit, StockUnit } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const readonlyClass =
  'w-full px-3 py-2.5 rounded-lg border border-border/60 bg-bone text-body text-mid-gray outline-none'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

const PURCHASE_UNIT_OPTIONS = PURCHASE_UNITS.map((u) => ({ value: u.value, label: u.label }))
const STOCK_UNIT_OPTIONS = [
  { value: 'g', label: 'Gramos (g)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidad' },
]

interface ItemFormProps {
  open: boolean
  onClose: () => void
  /** Insumo a editar; ausente/null = crear nuevo. */
  item?: InventoryItem | null
}

interface FormState {
  name: string
  category: string
  purchaseUnit: PurchaseUnit
  stockUnit: StockUnit
  factor: string
  unitCost: string
  parLevel: string
  reorderQty: string
  supplierId: string
  active: 'true' | 'false'
}

const EMPTY: FormState = {
  name: '',
  category: '',
  purchaseUnit: 'unidad',
  stockUnit: 'unidad',
  factor: '1',
  unitCost: '',
  parLevel: '',
  reorderQty: '',
  supplierId: '',
  active: 'true',
}

function fromItem(item: InventoryItem): FormState {
  return {
    name: item.name ?? '',
    category: item.category ?? '',
    purchaseUnit: (item.purchaseUnit as PurchaseUnit) ?? 'unidad',
    stockUnit: item.stockUnit ?? 'unidad',
    factor: item.purchaseToStockFactor != null ? String(item.purchaseToStockFactor) : '',
    unitCost: item.unitCost != null ? String(item.unitCost) : '',
    parLevel: item.parLevel != null ? String(item.parLevel) : '',
    reorderQty: item.reorderQty != null ? String(item.reorderQty) : '',
    supplierId: item.supplierId ?? '',
    active: item.active === false ? 'false' : 'true',
  }
}

export function ItemForm({ open, onClose, item }: ItemFormProps) {
  const { create, update } = useInventoryItemMutations()
  const { data: suppliers } = useSuppliers()
  const [form, setForm] = useState<FormState>(EMPTY)

  const isEdit = !!item

  useEffect(() => {
    if (!open) return
    setForm(item ? fromItem(item) : EMPTY)
  }, [open, item])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setField(e.target.name as keyof FormState, e.target.value as FormState[keyof FormState])
  }

  // Al cambiar la unidad de compra, autocompletamos la unidad de stock y el factor.
  // Para empaques (caja) limpiamos el factor para que se pregunte "unidades por caja".
  function changePurchaseUnit(value: string) {
    const def = getPurchaseUnit(value)
    setForm((prev) => ({
      ...prev,
      purchaseUnit: value as PurchaseUnit,
      stockUnit: def?.stockUnit ?? prev.stockUnit,
      factor: def && def.factor != null ? String(def.factor) : '',
    }))
  }

  const def = getPurchaseUnit(form.purchaseUnit)
  const isPackaging = def?.isPackaging ?? false
  const factorNum = Number(form.factor)
  const unitCostNum = Number(form.unitCost)
  const perUnitCost = costPerStockUnit(unitCostNum, factorNum)
  const pending = create.isPending || update.isPending

  const packagingLabel =
    form.stockUnit === 'unidad' ? 'Unidades por caja' : `${stockUnitLabel(form.stockUnit)} por caja`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return

    const data: InventoryItemFormData = {
      name: form.name.trim(),
      category: form.category.trim(),
      stockUnit: form.stockUnit,
      purchaseUnit: form.purchaseUnit,
      purchaseToStockFactor: factorNum > 0 ? factorNum : 1,
      active: form.active === 'true',
      ...(form.unitCost ? { unitCost: unitCostNum } : {}),
      ...(form.parLevel ? { parLevel: Number(form.parLevel) } : {}),
      ...(form.reorderQty ? { reorderQty: Number(form.reorderQty) } : {}),
      ...(form.supplierId ? { supplierId: form.supplierId } : {}),
    }

    if (isEdit && item) {
      await update.mutateAsync({ id: item.id, data })
    } else {
      await create.mutateAsync(data)
    }
    onClose()
  }

  const supplierOptions = [
    { value: '', label: 'Sin proveedor' },
    ...suppliers.map((s) => ({ value: s.id, label: s.name })),
  ]

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
                {isEdit ? 'Editar insumo' : 'Nuevo insumo'}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Nombre</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="Ej: Carne molida, Pan brioche, Coca-Cola"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Unidad de compra</label>
                    <SelectInput
                      value={form.purchaseUnit}
                      onChange={changePurchaseUnit}
                      options={PURCHASE_UNIT_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Unidad de stock</label>
                    <SelectInput
                      value={form.stockUnit}
                      onChange={(v) => setField('stockUnit', v as StockUnit)}
                      options={STOCK_UNIT_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{isPackaging ? packagingLabel : 'Equivalencia'}</label>
                    {isPackaging ? (
                      <input
                        name="factor"
                        type="number"
                        min="0"
                        step="any"
                        value={form.factor}
                        onChange={handleChange}
                        required
                        placeholder="Ej: 12, 24"
                        className={inputClass}
                      />
                    ) : (
                      <input
                        value={`1 ${def?.label ?? form.purchaseUnit} = ${factorNum.toLocaleString('es-CO')} ${form.stockUnit}`}
                        readOnly
                        tabIndex={-1}
                        className={readonlyClass}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Costo de compra</label>
                    <CurrencyInput
                      name="unitCost"
                      value={form.unitCost}
                      onChange={(raw) => setField('unitCost', raw)}
                      placeholder="0"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Costo por {form.stockUnit}</label>
                    <input
                      value={perUnitCost > 0 ? `${formatCurrency(perUnitCost)} / ${form.stockUnit}` : '—'}
                      readOnly
                      tabIndex={-1}
                      className={readonlyClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Proveedor</label>
                    <SelectInput
                      value={form.supplierId}
                      onChange={(v) => setField('supplierId', v)}
                      options={supplierOptions}
                      placeholder="Sin proveedor"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Categoría</label>
                    <input
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      placeholder="Ej: Cárnicos, Bebidas"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estado</label>
                    <SelectInput
                      value={form.active}
                      onChange={(v) => setField('active', v as 'true' | 'false')}
                      options={[
                        { value: 'true', label: 'Activo' },
                        { value: 'false', label: 'Inactivo' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Stock mínimo</label>
                    <input
                      name="parLevel"
                      type="number"
                      min="0"
                      step="any"
                      value={form.parLevel}
                      onChange={handleChange}
                      placeholder={`En ${form.stockUnit}`}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cantidad a pedir</label>
                    <input
                      name="reorderQty"
                      type="number"
                      min="0"
                      step="any"
                      value={form.reorderQty}
                      onChange={handleChange}
                      placeholder={`En ${def?.label.toLowerCase() ?? 'compra'}`}
                      className={inputClass}
                    />
                  </div>
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
                  disabled={pending}
                  className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Guardar insumo'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
