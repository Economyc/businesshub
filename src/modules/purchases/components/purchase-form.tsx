import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useProducts, usePurchases } from '../hooks'
import { formatCurrency } from '@/core/utils/format'
import { useSuppliers } from '@/modules/suppliers/hooks'
import { purchaseService } from '../services'
import { UNIT_OPTIONS } from '../types'
import type { PurchaseItem } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface FormItem {
  productId: string
  productName: string
  quantity: string
  unit: string
  unitPrice: string
}

export function PurchaseForm() {
  const navigate = useNavigate()
  const { data: suppliers } = useSuppliers()
  const { data: products } = useProducts()
  const { data: historicalPurchases } = usePurchases()

  const priceComparisons = useMemo(() => {
    const map = new Map<string, { avgPrice: number; bestPrice: number; bestSupplier: string }>()

    const productPrices = new Map<string, { prices: number[]; bestPrice: number; bestSupplier: string }>()

    for (const purchase of historicalPurchases) {
      for (const item of purchase.items) {
        const existing = productPrices.get(item.productId) ?? { prices: [], bestPrice: Infinity, bestSupplier: '' }
        existing.prices.push(item.unitPrice)
        if (item.unitPrice < existing.bestPrice) {
          existing.bestPrice = item.unitPrice
          existing.bestSupplier = purchase.supplierName
        }
        productPrices.set(item.productId, existing)
      }
    }

    for (const [productId, data] of productPrices) {
      if (data.prices.length === 0) continue
      map.set(productId, {
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        bestPrice: data.bestPrice,
        bestSupplier: data.bestSupplier,
      })
    }

    return map
  }, [historicalPurchases])

  const mutation = useFirestoreMutation(
    'purchases',
    (companyId, data: any) => purchaseService.create(companyId, data),
    { invalidate: ['transactions'] },
  )

  const [form, setForm] = useState({
    supplierId: '',
    date: '',
    invoiceNumber: '',
    status: 'received' as 'received' | 'partial' | 'pending',
    paymentStatus: 'pending' as 'paid' | 'pending' | 'overdue',
    paymentDueDate: '',
    notes: '',
    taxPercent: '0',
  })

  const [items, setItems] = useState<FormItem[]>([
    { productId: '', productName: '', quantity: '', unit: 'kg', unitPrice: '' },
  ])

  const supplierOptions = useMemo(() =>
    suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  )

  const productOptions = useMemo(() =>
    products.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` })),
    [products]
  )

  const selectedSupplierName = suppliers.find((s) => s.id === form.supplierId)?.name ?? ''

  // Auto-calculate payment due date based on supplier's payment terms
  useEffect(() => {
    if (!form.supplierId || !form.date) return
    const supplier = suppliers.find((s) => s.id === form.supplierId)
    if (!supplier?.paymentTerms) return

    const purchaseDate = new Date(form.date)
    if (isNaN(purchaseDate.getTime())) return

    const dueDate = new Date(purchaseDate)
    dueDate.setDate(dueDate.getDate() + supplier.paymentTerms)
    const dueDateStr = dueDate.toISOString().split('T')[0]

    setForm((prev) => ({ ...prev, paymentDueDate: dueDateStr }))
  }, [form.supplierId, form.date, suppliers])

  function handleProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        productId,
        productName: product?.name ?? '',
        unit: product?.unit ?? updated[index].unit,
        unitPrice: product ? String(product.referencePrice) : updated[index].unitPrice,
      }
      return updated
    })
  }

  function handleItemChange(index: number, field: keyof FormItem, value: string) {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addItem() {
    setItems((prev) => [...prev, { productId: '', productName: '', quantity: '', unit: 'kg', unitPrice: '' }])
  }

  function removeItem(index: number) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  const taxAmount = subtotal * (Number(form.taxPercent) || 0) / 100
  const total = subtotal + taxAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplierId) return
    const purchaseItems: PurchaseItem[] = items
      .filter((item) => item.productName && Number(item.quantity) > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.quantity) * Number(item.unitPrice),
      }))

    await mutation.mutateAsync({
      supplierId: form.supplierId,
      supplierName: selectedSupplierName,
      date: Timestamp.fromDate(new Date(form.date)),
      invoiceNumber: form.invoiceNumber || undefined,
      items: purchaseItems,
      subtotal,
      tax: taxAmount,
      total,
      status: form.status,
      paymentStatus: form.paymentStatus,
      paymentDueDate: form.paymentDueDate ? Timestamp.fromDate(new Date(form.paymentDueDate)) : undefined,
      notes: form.notes || undefined,
    } as any)
    navigate('/finance/purchases')
  }

  return (
    <PageTransition>
      <PageHeader title="Nueva Compra" />

      <form onSubmit={handleSubmit}>
        <div className="bg-surface rounded-xl card-elevated p-6 mb-5">
          <h3 className="text-body font-medium text-dark-graphite mb-4">Información General</h3>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Proveedor</label>
              <SelectInput
                value={form.supplierId}
                onChange={(v) => setForm((prev) => ({ ...prev, supplierId: v }))}
                options={[{ value: '', label: 'Seleccionar proveedor...' }, ...supplierOptions]}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha</label>
              <DateInput
                value={form.date}
                onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
                required
              />
            </div>
            <div>
              <label className={labelClass}>N° Factura (opcional)</label>
              <input
                value={form.invoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="Número de factura"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Estado Recepción</label>
              <SelectInput
                value={form.status}
                onChange={(v) => setForm((prev) => ({ ...prev, status: v as any }))}
                options={[
                  { value: 'received', label: 'Recibido' },
                  { value: 'partial', label: 'Parcial' },
                  { value: 'pending', label: 'Pendiente' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Estado de Pago</label>
              <SelectInput
                value={form.paymentStatus}
                onChange={(v) => setForm((prev) => ({ ...prev, paymentStatus: v as any }))}
                options={[
                  { value: 'paid', label: 'Pagado' },
                  { value: 'pending', label: 'Pendiente' },
                  { value: 'overdue', label: 'Vencido' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha Vencimiento Pago</label>
              <DateInput
                value={form.paymentDueDate}
                onChange={(v) => setForm((prev) => ({ ...prev, paymentDueDate: v }))}
              />
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl card-elevated p-6 mb-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-body font-medium text-dark-graphite">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-caption font-medium text-graphite border border-input-border hover:bg-bone transition-colors"
            >
              <Plus size={13} strokeWidth={2} />
              Agregar
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-[2fr_0.8fr_0.6fr_1fr_1fr_auto] gap-2 text-caption uppercase tracking-wider text-mid-gray px-1">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Unidad</span>
              <span>Precio Unit.</span>
              <span>Subtotal</span>
              <span></span>
            </div>

            {items.map((item, index) => {
              const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
              const currentPrice = Number(item.unitPrice) || 0
              const comparison = item.productId ? priceComparisons.get(item.productId) : null

              return (
                <div key={index}>
                  <div className="grid grid-cols-[2fr_0.8fr_0.6fr_1fr_1fr_auto] gap-2 items-center">
                    <SelectInput
                      value={item.productId}
                      onChange={(v) => handleProductSelect(index, v)}
                      options={[{ value: '', label: 'Seleccionar...' }, ...productOptions]}
                    />
                    <input
                      type="number"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="0"
                      className={inputClass}
                    />
                    <SelectInput
                      value={item.unit}
                      onChange={(v) => handleItemChange(index, 'unit', v)}
                      options={UNIT_OPTIONS}
                    />
                    <CurrencyInput
                      name={`price-${index}`}
                      value={item.unitPrice}
                      onChange={(raw) => handleItemChange(index, 'unitPrice', raw)}
                      placeholder="0"
                      className={inputClass}
                    />
                    <div className="px-3 py-2.5 text-body text-graphite">
                      ${itemSubtotal.toLocaleString('es-CO')}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="p-2 rounded-lg text-mid-gray hover:text-negative-text hover:bg-negative-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  {comparison && currentPrice > 0 && (
                    currentPrice <= comparison.bestPrice ? (
                      <div className="flex items-center gap-1.5 px-1 pt-1 pb-1 text-caption text-positive-text">
                        <TrendingDown size={12} strokeWidth={2} />
                        Mejor precio registrado
                      </div>
                    ) : currentPrice > comparison.avgPrice ? (
                      <div className="flex items-center gap-1.5 px-1 pt-1 pb-1 text-caption text-warning-text">
                        <TrendingUp size={12} strokeWidth={2} />
                        Promedio: {formatCurrency(comparison.avgPrice)} · Mejor: {formatCurrency(comparison.bestPrice)} ({comparison.bestSupplier})
                      </div>
                    ) : null
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-body text-graphite">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-body text-graphite gap-3">
                  <span>IVA %</span>
                  <input
                    type="number"
                    value={form.taxPercent}
                    onChange={(e) => setForm((prev) => ({ ...prev, taxPercent: e.target.value }))}
                    className="w-20 px-2 py-1 rounded-lg border border-input-border bg-input-bg text-body text-graphite text-right focus:border-input-focus outline-none"
                  />
                  <span className="w-28 text-right">${taxAmount.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-subheading font-semibold text-dark-graphite pt-2 border-t border-border">
                  <span>Total</span>
                  <span>${total.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl card-elevated p-6 mb-5">
          <label className={labelClass}>Notas (opcional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Observaciones adicionales..."
            className={`${inputClass} min-h-[80px] resize-none`}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar Compra'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/finance/purchases')}
            className="px-5 py-2.5 rounded-lg border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
