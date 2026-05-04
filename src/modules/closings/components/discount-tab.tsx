import { useState, useMemo } from 'react'
import { Percent, Trash2, SquarePen, Gift, Tag } from 'lucide-react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { formatCurrency } from '@/core/utils/format'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { useDiscounts } from '../hooks'
import { discountService } from '../services'
import type { Discount, DiscountType, DiscountReason } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const TYPE_OPTIONS = [
  { value: 'partial', label: 'Parcial' },
  { value: 'full', label: 'Cortesia (100%)' },
]

const REASON_OPTIONS = [
  { value: 'Empleado', label: 'Empleado' },
  { value: 'Influencer', label: 'Influencer' },
  { value: 'Socio', label: 'Socio' },
  { value: 'Prueba de calidad', label: 'Prueba de calidad' },
  { value: 'Otro', label: 'Otro' },
]

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

const emptyForm = {
  date: '',
  type: '' as string,
  amount: '',
  reason: '' as string,
  description: '',
  authorizedBy: '',
}

function discountToForm(d: Discount) {
  return {
    date: d.date ?? '',
    type: d.type ?? '',
    amount: d.amount ? String(d.amount) : '',
    reason: d.reason ?? '',
    description: d.description ?? '',
    authorizedBy: d.authorizedBy ?? '',
  }
}

export function DiscountTab() {
  const { data: discounts, loading } = useDiscounts()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [success, setSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null)
  const [search, setSearch] = useState('')

  const createMutation = useFirestoreMutation(
    'discounts',
    (companyId, data: any) => discountService.create(companyId, data),
  )
  const updateMutation = useFirestoreMutation(
    'discounts',
    (companyId, data: { id: string; payload: any }) => discountService.update(companyId, data.id, data.payload),
  )
  const deleteMutation = useFirestoreMutation(
    'discounts',
    (companyId, id: string) => discountService.remove(companyId, id),
    { optimisticDelete: true },
  )
  const submitting = createMutation.isPending || updateMutation.isPending

  const sorted = useMemo(() => {
    return [...discounts].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [discounts])

  const filtered = useMemo(() => {
    return sorted.filter((d) => {
      if (search === '') return true
      const q = search.toLowerCase()
      return (
        (d.date ?? '').includes(q) ||
        (d.reason ?? '').toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        (d.authorizedBy ?? '').toLowerCase().includes(q)
      )
    })
  }, [sorted, search])

  const totalDescuentos = useMemo(() => {
    return filtered.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  }, [filtered])

  function resetForm() {
    setForm(emptyForm)
    setEditing(null)
  }

  function handleEdit(d: Discount) {
    setEditing(d)
    setForm(discountToForm(d))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      date: form.date,
      type: form.type as DiscountType,
      amount: Number(form.amount || 0),
      reason: form.reason as DiscountReason,
      description: form.description,
      authorizedBy: form.authorizedBy,
    }
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    resetForm()
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const columns = [
    {
      key: 'date',
      header: 'Fecha',
      width: '0.8fr',
      render: (d: Discount) => <span className="font-medium text-dark-graphite">{formatDate(d.date)}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      width: '0.7fr',
      render: (d: Discount) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
          d.type === 'full'
            ? 'bg-warning-bg text-warning-text'
            : 'bg-info-bg text-info-text'
        }`}>
          {d.type === 'full' ? <Gift size={11} /> : <Tag size={11} />}
          {d.type === 'full' ? 'Cortesia' : 'Parcial'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Monto',
      width: '0.8fr',
      primary: true,
      render: (d: Discount) => <span className="font-semibold text-dark-graphite">{formatCurrency(d.amount ?? 0)}</span>,
    },
    {
      key: 'reason',
      header: 'Motivo',
      width: '0.8fr',
      render: (d: Discount) => d.reason || '--',
    },
    {
      key: 'description',
      header: 'Detalle',
      width: '1.2fr',
      render: (d: Discount) => (
        <span className="truncate block max-w-[200px]" title={d.description}>
          {d.description || '--'}
        </span>
      ),
    },
    {
      key: 'authorizedBy',
      header: 'Autorizado por',
      width: '0.8fr',
      render: (d: Discount) => d.authorizedBy || '--',
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (d: Discount) => (
        <div className="flex items-center gap-1">
          <HoverHint label="Editar">
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(d) }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all duration-150"
            >
              <SquarePen size={14} strokeWidth={1.5} />
            </button>
          </HoverHint>
          <HoverHint label="Eliminar">
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(d) }}
              className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </HoverHint>
        </div>
      ),
    },
  ]

  return (
    <>
      {/* Form - card-based layout */}
      <form onSubmit={handleSubmit} className="bg-surface rounded-2xl card-elevated p-4 sm:p-6 mb-6">
        <h2 className="text-caption font-extrabold uppercase tracking-widest text-mid-gray mb-4 flex items-center gap-2">
          <Tag size={14} />
          {editing ? 'Editar Descuento' : 'Registrar Descuento'}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo</label>
              <SelectInput
                value={form.type}
                onChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
                options={TYPE_OPTIONS}
                placeholder="Seleccionar..."
              />
            </div>
            <div>
              <label className={labelClass}>Monto</label>
              <CurrencyInput
                name="amount"
                value={form.amount}
                onChange={(raw) => setForm((prev) => ({ ...prev, amount: raw }))}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Fecha</label>
              <DateInput
                value={form.date}
                onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Motivo</label>
              <SelectInput
                value={form.reason}
                onChange={(v) => setForm((prev) => ({ ...prev, reason: v }))}
                options={REASON_OPTIONS}
                placeholder="Seleccionar..."
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Detalle</label>
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Nombre, producto, contexto..."
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Autorizado por</label>
            <input
              value={form.authorizedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, authorizedBy: e.target.value }))}
              placeholder="Nombre del manager"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-5 pt-4 border-t border-border">
          {success && (
            <span className="text-caption text-green-600 font-medium">
              {editing ? 'Descuento actualizado' : 'Descuento registrado'}
            </span>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto sm:ml-auto">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl btn-primary text-body font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar Descuento'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-mid-gray text-body font-bold transition-all duration-200 hover:bg-bone"
            >
              Limpiar
            </button>
          </div>
        </div>
      </form>

      {/* Accumulated total + search */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="block text-[11px] font-bold text-mid-gray uppercase tracking-wide">Total Descuentos</span>
          <span className="text-xl font-extrabold text-dark-graphite">{formatCurrency(totalDescuentos)}</span>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar motivo, detalle o responsable..." />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No hay descuentos"
          description="Registra descuentos y cortesias para llevar seguimiento"
        />
      ) : (
        <>
          {/* Mobile: custom cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {filtered.map((d) => (
              <div key={d.id} className="bg-surface rounded-xl card-elevated p-3.5 flex items-center justify-between">
                <div className="flex gap-3 items-center min-w-0">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    d.type === 'full' ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-500'
                  }`}>
                    {d.type === 'full' ? <Gift size={20} /> : <Tag size={20} />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-dark-graphite text-[14px] leading-tight truncate">
                      {d.reason || 'Sin motivo'}{d.description ? ` (${d.description})` : ''}
                    </h4>
                    <span className="text-[11px] text-mid-gray font-semibold">
                      {formatDate(d.date)} · Aut: {d.authorizedBy || '—'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className={`block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded mb-1 inline-block ${
                    d.type === 'full'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {d.type === 'full' ? 'Cortesía' : 'Parcial'}
                  </span>
                  <span className="block font-bold text-dark-graphite">{formatCurrency(d.amount ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop: full table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={filtered} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar Descuento"
        description={`Eliminar descuento de ${deleteTarget ? formatCurrency(deleteTarget.amount) : ''} del ${deleteTarget ? formatDate(deleteTarget.date) : ''}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
