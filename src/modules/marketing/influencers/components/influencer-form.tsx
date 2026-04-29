import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Plus } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { modalVariants } from '@/core/animations/variants'
import { formatCurrency } from '@/core/utils/format'
import { influencerService } from '../services'
import { usePosOrderSearch } from '../hooks'
import type { InfluencerVisit, SocialPlatform, SocialNetwork } from '../types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'other', label: 'Otra' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Completado' },
]

interface InfluencerFormProps {
  open: boolean
  onClose: () => void
  visit?: InfluencerVisit | null
}

function toDateStr(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return ''
  const d = ts.toDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function InfluencerForm({ open, onClose, visit }: InfluencerFormProps) {
  const { selectedCompany } = useCompany()
  const { orders, loading: ordersLoading, search: searchOrders } = usePosOrderSearch()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isEditing = !!visit

  const saveMutation = useFirestoreMutation(
    'influencer-visits',
    async (companyId: string, data: any) => {
      const { id, ...rest } = data
      if (id) await influencerService.update(companyId, id, rest)
      else await influencerService.create(companyId, rest)
    },
  )

  const deleteMutation = useFirestoreMutation(
    'influencer-visits',
    (companyId: string, id: string) => influencerService.remove(companyId, id),
    { optimisticDelete: true },
  )

  const [form, setForm] = useState({
    name: '',
    socialNetworks: [{ platform: 'instagram' as SocialPlatform, handle: '' }] as SocialNetwork[],
    visitDate: '',
    selectedOrderId: '',
    story: false,
    post: false,
    reel: false,
    notes: '',
    status: 'pending' as 'pending' | 'completed',
  })

  const orderOptions = useMemo(() => {
    const opts = [{ value: '', label: 'Sin pedido asociado' }]
    for (const o of orders) {
      const items = o.items.slice(0, 3).join(', ') + (o.items.length > 3 ? '...' : '')
      opts.push({
        value: o.ID,
        label: `${o.documento} ${o.serie}-${o.correlativo} — ${formatCurrency(o.total)} (${items})`,
      })
    }
    return opts
  }, [orders])

  useEffect(() => {
    if (open && visit) {
      const dateStr = toDateStr(visit.visitDate)
      setForm({
        name: visit.name,
        socialNetworks: visit.socialNetworks?.length > 0
          ? visit.socialNetworks
          : [{ platform: 'instagram', handle: '' }],
        visitDate: dateStr,
        selectedOrderId: visit.order?.id ?? visit.order?.documento ?? '',
        story: visit.content?.story ?? false,
        post: visit.content?.post ?? false,
        reel: visit.content?.reel ?? false,
        notes: visit.notes ?? '',
        status: visit.status,
      })
      if (dateStr) searchOrders(dateStr)
    } else if (open && !visit) {
      resetForm()
    }
  }, [open, visit?.id])

  function resetForm() {
    setForm({
      name: '',
      socialNetworks: [{ platform: 'instagram', handle: '' }],
      visitDate: '',
      selectedOrderId: '',
      story: false,
      post: false,
      reel: false,
      notes: '',
      status: 'pending',
    })
  }

  function handleDateChange(dateStr: string) {
    setForm((prev) => ({ ...prev, visitDate: dateStr, selectedOrderId: '' }))
    if (dateStr) searchOrders(dateStr)
  }

  function addNetwork() {
    setForm((prev) => ({
      ...prev,
      socialNetworks: [...prev.socialNetworks, { platform: 'instagram', handle: '' }],
    }))
  }

  function removeNetwork(index: number) {
    setForm((prev) => ({
      ...prev,
      socialNetworks: prev.socialNetworks.filter((_, i) => i !== index),
    }))
  }

  function updateNetwork(index: number, field: keyof SocialNetwork, value: string) {
    setForm((prev) => ({
      ...prev,
      socialNetworks: prev.socialNetworks.map((n, i) =>
        i === index ? { ...n, [field]: value } : n,
      ),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return

    const validNetworks = form.socialNetworks.filter((n) => n.handle.trim())
    const selectedOrder = orders.find((o) => o.ID === form.selectedOrderId)

    const data: any = {
      name: form.name,
      socialNetworks: validNetworks,
      visitDate: form.visitDate
        ? Timestamp.fromDate(new Date(form.visitDate + 'T12:00:00'))
        : Timestamp.now(),
      content: { story: form.story, post: form.post, reel: form.reel },
      notes: form.notes || '',
      status: form.status,
    }

    if (selectedOrder) {
      data.order = {
        id: selectedOrder.ID,
        documento: `${selectedOrder.documento} ${selectedOrder.serie}-${selectedOrder.correlativo}`,
        total: selectedOrder.total,
        fecha: selectedOrder.fecha,
        items: selectedOrder.items,
      }
    } else if (visit?.order && form.selectedOrderId === visit.order.id) {
      data.order = visit.order
    }

    await saveMutation.mutateAsync(isEditing ? { id: visit.id, ...data } : data)
    resetForm()
    onClose()
  }

  async function handleDelete() {
    if (!selectedCompany || !visit) return
    await deleteMutation.mutateAsync(visit.id)
    setDeleteOpen(false)
    resetForm()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function handleCancel() {
    resetForm()
    setDeleteOpen(false)
    onClose()
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-[2px]"
              onClick={handleCancel}
            />
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative bg-surface-elevated rounded-xl shadow-lg w-full max-w-2xl mx-4 border border-border max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
                <h2 className="text-subheading font-semibold text-dark-graphite">
                  {isEditing ? 'Editar Influencer' : 'Nuevo Influencer'}
                </h2>
                <button
                  onClick={handleCancel}
                  className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Nombre */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Nombre</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      placeholder="Nombre del influencer"
                      className={inputClass}
                    />
                  </div>

                  {/* Redes Sociales */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Redes Sociales</label>
                    <div className="space-y-2">
                      {form.socialNetworks.map((network, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <SelectInput
                            value={network.platform}
                            onChange={(val) => updateNetwork(i, 'platform', val)}
                            options={PLATFORM_OPTIONS}
                            className="!w-36 shrink-0"
                          />
                          <input
                            value={network.handle}
                            onChange={(e) => updateNetwork(i, 'handle', e.target.value)}
                            placeholder="@usuario"
                            className={`${inputClass} flex-1`}
                          />
                          {form.socialNetworks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeNetwork(i)}
                              className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150 shrink-0"
                            >
                              <X size={14} strokeWidth={1.5} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addNetwork}
                        className="flex items-center gap-1 text-caption text-mid-gray hover:text-graphite transition-colors"
                      >
                        <Plus size={13} strokeWidth={2} />
                        Agregar red
                      </button>
                    </div>
                  </div>

                  {/* Fecha de visita */}
                  <div>
                    <label className={labelClass}>Fecha de visita</label>
                    <DateInput
                      value={form.visitDate}
                      onChange={handleDateChange}
                      required
                    />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className={labelClass}>Estado</label>
                    <SelectInput
                      value={form.status}
                      onChange={(val) => setForm((prev) => ({ ...prev, status: val as 'pending' | 'completed' }))}
                      options={STATUS_OPTIONS}
                    />
                  </div>

                  {/* Pedido asociado */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Pedido asociado</label>
                    {!form.visitDate ? (
                      <p className="text-caption text-mid-gray py-2.5">Selecciona una fecha para buscar pedidos</p>
                    ) : ordersLoading ? (
                      <p className="text-caption text-mid-gray py-2.5">Buscando pedidos...</p>
                    ) : orders.length === 0 ? (
                      <p className="text-caption text-mid-gray py-2.5">No hay pedidos para esta fecha</p>
                    ) : (
                      <SelectInput
                        value={form.selectedOrderId}
                        onChange={(val) => setForm((prev) => ({ ...prev, selectedOrderId: val }))}
                        options={orderOptions}
                        placeholder="Sin pedido asociado"
                      />
                    )}
                  </div>

                  {/* Checklist de contenido */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Contenido publicado</label>
                    <div className="flex gap-3 mt-1">
                      {([
                        { key: 'story' as const, label: 'Story' },
                        { key: 'post' as const, label: 'Post' },
                        { key: 'reel' as const, label: 'Reel' },
                      ]).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] border text-body font-medium transition-all duration-200 ${
                            form[key]
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : 'border-input-border bg-input-bg text-mid-gray hover:bg-bone'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] transition-colors ${
                            form[key]
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {form[key] && '✓'}
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notas</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas adicionales..."
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
                  {isEditing && (
                    <HoverHint label="Eliminar">
                      <button
                        type="button"
                        onClick={() => setDeleteOpen(true)}
                        className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </HoverHint>
                  )}
                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saveMutation.isPending ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Influencer"
        description={`¿Estás seguro de que deseas eliminar a ${form.name || 'este influencer'}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  )
}
