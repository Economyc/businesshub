import { useState, useMemo } from 'react'
import { Percent, Trash2, SquarePen, Gift, Tag } from 'lucide-react'
import { CurrencyInput } from '@/core/ui/currency-input'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { SearchInput } from '@/core/ui/search-input'
import { DataTable } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { formatCurrency } from '@/core/utils/format'
import { useCompany } from '@/core/hooks/use-company'
import { useDiscounts } from '../hooks'
import { discountService } from '../services'
import type { Discount, DiscountType, DiscountReason } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
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
  const { selectedCompany } = useCompany()
  const { data: discounts, loading, refetch } = useDiscounts()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null)
  const [search, setSearch] = useState('')

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
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      const payload = {
        date: form.date,
        type: form.type as DiscountType,
        amount: Number(form.amount || 0),
        reason: form.reason as DiscountReason,
        description: form.description,
        authorizedBy: form.authorizedBy,
      }
      if (editing) {
        await discountService.update(selectedCompany.id, editing.id, payload)
      } else {
        await discountService.create(selectedCompany.id, payload)
      }
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      refetch()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!selectedCompany || !deleteTarget) return
    await discountService.remove(selectedCompany.id, deleteTarget.id)
    setDeleteTarget(null)
    refetch()
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
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(d) }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all duration-150"
            title="Editar"
          >
            <SquarePen size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(d) }}
            className="p-1.5 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            title="Eliminar"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      {/* Form */}
      <div className="bg-surface rounded-xl card-elevated p-6 mb-6">
        <h2 className="text-subheading font-semibold text-dark-graphite mb-5">
          {editing ? 'Editar Descuento' : 'Registrar Descuento'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Fecha</label>
              <DateInput
                value={form.date}
                onChange={(v) => setForm((prev) => ({ ...prev, date: v }))}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <SelectInput
                value={form.type}
                onChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
                options={TYPE_OPTIONS}
                placeholder="Seleccionar tipo..."
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
            <div>
              <label className={labelClass}>Motivo</label>
              <SelectInput
                value={form.reason}
                onChange={(v) => setForm((prev) => ({ ...prev, reason: v }))}
                options={REASON_OPTIONS}
                placeholder="Seleccionar motivo..."
              />
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
                placeholder="Quien autorizo"
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
            {success && (
              <span className="text-caption text-green-600 font-medium">
                {editing ? 'Descuento actualizado' : 'Descuento registrado'}
              </span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Guardando...' : editing ? 'Actualizar Descuento' : 'Guardar Descuento'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="mb-4 text-caption text-mid-gray">
        Total descuentos:{' '}
        <span className="font-medium text-graphite">
          {formatCurrency(totalDescuentos)}
        </span>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por motivo, detalle o responsable..." />
        </div>
      </div>

      {loading ? (
        <div className="text-body text-mid-gray py-8 text-center">Cargando...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Percent}
          title="No hay descuentos"
          description="Registra descuentos y cortesias para llevar seguimiento"
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
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
