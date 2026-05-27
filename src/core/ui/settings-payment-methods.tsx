import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Plus, X } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { SelectInput } from '@/core/ui/select-input'
import { modalVariants } from '@/core/animations/variants'
import { usePaymentMethods } from '@/modules/payment-methods/hooks'
import { PAYMENT_METHOD_TYPE_ICON } from '@/modules/payment-methods/icons'
import {
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_TYPE_ORDER,
  type PaymentMethod,
  type PaymentMethodType,
} from '@/modules/payment-methods/types'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

const TYPE_OPTIONS = PAYMENT_METHOD_TYPE_ORDER.map((t) => ({
  value: t,
  label: PAYMENT_METHOD_TYPE_LABELS[t],
  icon: PAYMENT_METHOD_TYPE_ICON[t],
}))

function TypeBadge({ type }: { type: PaymentMethodType }) {
  const Icon = PAYMENT_METHOD_TYPE_ICON[type]
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-bone/40 text-caption text-mid-gray">
      <Icon size={13} strokeWidth={1.5} />
      {PAYMENT_METHOD_TYPE_LABELS[type]}
    </span>
  )
}

interface FormState {
  name: string
  type: PaymentMethodType
  entity: string
  last4: string
}

const EMPTY_FORM: FormState = { name: '', type: 'credit_card', entity: '', last4: '' }

export function SettingsPaymentMethods() {
  const { methods, addMethod, updateMethod, removeMethod } = usePaymentMethods()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null)

  useEffect(() => {
    if (!formOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFormOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [formOpen])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(m: PaymentMethod) {
    setEditing(m)
    setForm({ name: m.name, type: m.type, entity: m.entity ?? '', last4: m.last4 ?? '' })
    setFormOpen(true)
  }

  function handleSave() {
    const name = form.name.trim()
    if (!name) return
    const data = {
      name,
      type: form.type,
      ...(form.entity.trim() ? { entity: form.entity.trim() } : {}),
      ...(form.last4.trim() ? { last4: form.last4.trim() } : {}),
    }
    if (editing) {
      updateMethod(editing.id, data)
    } else {
      addMethod(data)
    }
    setFormOpen(false)
  }

  return (
    <PageTransition>
      <PageHeader title="Métodos de pago">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200"
        >
          <Plus size={14} strokeWidth={2} />
          Nuevo método
        </button>
      </PageHeader>

      <div className="rounded-xl bg-surface card-elevated overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 border-r border-border">Nombre</th>
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 border-r border-border">Tipo</th>
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 border-r border-border">Entidad</th>
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 border-r border-border">Últimos 4</th>
              <th className="text-right text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-b-0 group hover:bg-bone/30 transition-colors">
                <td className="px-4 py-3 border-r border-border">
                  <span className="text-body font-medium text-dark-graphite">{m.name}</span>
                </td>
                <td className="px-4 py-3 border-r border-border">
                  <TypeBadge type={m.type} />
                </td>
                <td className="px-4 py-3 border-r border-border">
                  {m.entity ? (
                    <span className="text-body text-mid-gray">{m.entity}</span>
                  ) : (
                    <span className="text-caption text-mid-gray/50">—</span>
                  )}
                </td>
                <td className="px-4 py-3 border-r border-border">
                  {m.last4 ? (
                    <span className="text-body text-graphite tabular-nums">••••{m.last4}</span>
                  ) : (
                    <span className="text-caption text-mid-gray/50">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-all"
                      aria-label="Editar"
                    >
                      <Pencil size={13} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {methods.length === 0 && (
          <div className="px-4 py-8 text-center text-body text-mid-gray">
            No hay métodos de pago
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      <AnimatePresence>
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20"
              onClick={() => setFormOpen(false)}
            />
            <motion.div
              variants={modalVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative bg-surface-elevated rounded-xl p-6 max-w-md w-full mx-4 border border-border"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-subheading font-medium text-dark-graphite">
                  {editing ? 'Editar método de pago' : 'Nuevo método de pago'}
                </h3>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">Nombre</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
                    placeholder="Ej: Nu Crédito"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">Tipo</label>
                  <SelectInput
                    value={form.type}
                    onChange={(v) => setForm((f) => ({ ...f, type: v as PaymentMethodType }))}
                    options={TYPE_OPTIONS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">Entidad (opcional)</label>
                    <input
                      value={form.entity}
                      onChange={(e) => setForm((f) => ({ ...f, entity: e.target.value }))}
                      placeholder="Ej: Bancolombia"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-caption uppercase tracking-wider font-semibold text-mid-gray mb-1">Últimos 4 (opcional)</label>
                    <input
                      value={form.last4}
                      inputMode="numeric"
                      onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="Ej: 5815"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.name.trim()}
                  className="px-4 py-2 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editing ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar método de pago"
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={async () => { if (deleteTarget) removeMethod(deleteTarget.id); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  )
}
