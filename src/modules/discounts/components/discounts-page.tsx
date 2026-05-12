import { useState, useMemo, useRef } from 'react'
import { Percent, Trash2, SquarePen, Gift, Tag, Camera, X, ImageIcon, ExternalLink, AlertCircle } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
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
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { getAppFunctions } from '@/core/firebase/config'
import { useDiscounts } from '../hooks'
import { discountService } from '../services'
import type { Discount, DiscountType, DiscountReason, DiscountPhoto } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1'

const TYPE_OPTIONS = [
  { value: 'partial', label: 'Parcial' },
  { value: 'full', label: 'Cortesia (100%)' },
]

const REASON_OPTIONS = [
  { value: 'Socio', label: 'Socio' },
  { value: 'Bono', label: 'Bono' },
  { value: 'Influencer', label: 'Influencer' },
  { value: 'Prueba', label: 'Prueba' },
  { value: 'Empleado', label: 'Empleado' },
]

const MAX_PHOTO_SIZE = 10 * 1024 * 1024
const ACCEPTED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function formatDate(dateStr: string): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function todayLocalISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyForm = {
  date: todayLocalISO(),
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

export function DiscountsPage() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? ''
  const { can } = usePermissions()
  const canEdit = can('closings', 'create')
  const { data: discounts, loading } = useDiscounts()

  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [success, setSuccess] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Foto: si hay archivo nuevo seleccionado se sube; si se está editando y no se
  // tocó, se conserva la existente. En creación la foto es obligatoria.
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const createMutation = useFirestoreMutation(
    'discounts',
    (cid, data: any) => discountService.create(cid, data),
  )
  const updateMutation = useFirestoreMutation(
    'discounts',
    (cid, data: { id: string; payload: any }) => discountService.update(cid, data.id, data.payload),
  )
  const deleteMutation = useFirestoreMutation(
    'discounts',
    (cid, id: string) => discountService.remove(cid, id),
    { optimisticDelete: true },
  )
  const submitting = createMutation.isPending || updateMutation.isPending || uploading

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

  function clearPhoto() {
    setPhotoFile(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    if (f.size > MAX_PHOTO_SIZE) {
      setError('La foto excede el límite de 10 MB.')
      return
    }
    if (!ACCEPTED_PHOTO_MIMES.includes(f.type)) {
      setError('Formato no soportado. Usa JPG, PNG, WebP, HEIC o HEIF.')
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditing(null)
    clearPhoto()
    setError(null)
  }

  function handleEdit(d: Discount) {
    setEditing(d)
    setForm(discountToForm(d))
    clearPhoto()
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return
    setError(null)

    const hasExistingPhoto = !!editing?.photo
    if (!photoFile && !hasExistingPhoto) {
      setError('Adjunta una foto del descuento.')
      return
    }

    try {
      let photo: DiscountPhoto | undefined = editing?.photo
      if (photoFile) {
        setUploading(true)
        const base64 = await fileToBase64(photoFile)
        const fns = await getAppFunctions()
        const upload = httpsCallable<
          { companyId: string; reason: string; detail: string; date: string; fileBase64: string; fileName: string; mimeType: string },
          { driveFileId: string; webViewLink: string; fileName: string }
        >(fns, 'uploadDiscountPhotoToDrive')
        const res = await upload({
          companyId,
          reason: form.reason,
          detail: form.description.trim(),
          date: form.date,
          fileBase64: base64,
          fileName: photoFile.name,
          mimeType: photoFile.type,
        })
        photo = {
          driveFileId: res.data.driveFileId,
          driveWebViewLink: res.data.webViewLink,
          fileName: res.data.fileName,
          mimeType: photoFile.type,
          uploadedAt: Timestamp.now(),
        }
        setUploading(false)
      }

      const payload: any = {
        date: form.date,
        type: form.type as DiscountType,
        amount: Number(form.amount || 0),
        reason: form.reason as DiscountReason,
        description: form.description,
        authorizedBy: form.authorizedBy,
      }
      if (photo) payload.photo = photo

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      resetForm()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setUploading(false)
      setError((err as Error).message ?? 'Error al guardar el descuento')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  function canSubmit(): boolean {
    const hasPhoto = !!photoFile || !!editing?.photo
    return (
      !submitting &&
      !!form.date &&
      !!form.type &&
      Number(form.amount) > 0 &&
      !!form.reason &&
      !!form.authorizedBy.trim() &&
      hasPhoto
    )
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
      width: '0.7fr',
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
      key: 'photo',
      header: 'Foto',
      width: '60px',
      render: (d: Discount) => d.photo ? (
        <HoverHint label="Ver foto">
          <a
            href={d.photo.driveWebViewLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all duration-150"
          >
            <ImageIcon size={14} strokeWidth={1.5} />
          </a>
        </HoverHint>
      ) : <span className="text-mid-gray">--</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (d: Discount) => canEdit ? (
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
      ) : null,
    },
  ]

  return (
    <PageTransition>
      <PageHeader title="Descuentos" />

      {canEdit && (
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

            {/* Foto */}
            <div>
              <label className={labelClass}>Foto {editing?.photo ? '(opcional al editar)' : ''}</label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {photoFile && photoPreview ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bone/30">
                  <img src={photoPreview} alt="Vista previa" className="h-14 w-14 rounded-lg object-cover border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body text-graphite truncate">{photoFile.name}</p>
                    <p className="text-caption text-mid-gray">{formatBytes(photoFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearPhoto}
                    disabled={submitting}
                    className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-input-border bg-input-bg text-body font-medium text-graphite hover:bg-bone transition-colors"
                  >
                    <Camera size={15} strokeWidth={1.5} />
                    {editing?.photo ? 'Reemplazar foto' : 'Tomar / subir foto'}
                  </button>
                  {editing?.photo && (
                    <a
                      href={editing.photo.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-caption text-mid-gray hover:text-graphite transition-colors"
                    >
                      <ExternalLink size={12} strokeWidth={1.5} />
                      Ver foto actual
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-negative-bg border border-border/60 text-caption text-negative-text">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-5 pt-4 border-t border-border">
            {success && (
              <span className="text-caption text-green-600 font-medium">
                {editing ? 'Descuento actualizado' : 'Descuento registrado'}
              </span>
            )}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto sm:ml-auto">
              <button
                type="submit"
                disabled={!canSubmit()}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl btn-primary text-body font-bold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {uploading ? 'Subiendo foto...' : submitting ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar Descuento'}
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
      )}

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
        <TableSkeleton rows={5} columns={7} />
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
                    <span className="text-[11px] text-mid-gray font-semibold flex items-center gap-1.5">
                      {formatDate(d.date)} · Aut: {d.authorizedBy || '—'}
                      {d.photo && (
                        <a href={d.photo.driveWebViewLink} target="_blank" rel="noopener noreferrer" className="inline-flex">
                          <ImageIcon size={12} strokeWidth={1.5} />
                        </a>
                      )}
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
    </PageTransition>
  )
}
