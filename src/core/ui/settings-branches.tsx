import { useEffect, useState } from 'react'
import { Loader2, MapPin, Plus, Power, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import {
  fetchBranches,
  createBranch,
  updateBranch,
  setBranchActive,
  removeBranch,
  type BranchInput,
} from '@/core/services/branches-service'
import type { Branch } from '@/core/types/branch'
import { ConfirmDialog } from './confirm-dialog'
import { PageHeader } from './page-header'
import { PageTransition } from './page-transition'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

const labelClass = 'block text-caption font-medium text-graphite mb-1.5'

export function SettingsBranches() {
  const { selectedCompany } = useCompany()
  const { isAdmin } = usePermissions()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)

  async function loadBranches() {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const data = await fetchBranches(selectedCompany.id)
      data.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setBranches(data)
    } catch (err) {
      console.error('Error loading branches:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [selectedCompany?.id])

  async function handleToggleActive(branch: Branch) {
    if (!selectedCompany) return
    await setBranchActive(selectedCompany.id, branch.id, !branch.isActive)
    setBranches((prev) =>
      prev.map((b) => (b.id === branch.id ? { ...b, isActive: !branch.isActive } : b)),
    )
  }

  async function handleDelete() {
    if (!selectedCompany || !deleteTarget) return
    await removeBranch(selectedCompany.id, deleteTarget.id)
    setBranches((prev) => prev.filter((b) => b.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <PageTransition>
      <PageHeader title="Sedes" />

      {isAdmin && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            <Plus size={14} strokeWidth={2} />
            Nueva sede
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-smoke animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-surface card-elevated overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3">
                  Sede
                </th>
                <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 hidden sm:table-cell">
                  POS
                </th>
                <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 hidden md:table-cell">
                  Estado
                </th>
                {isAdmin && (
                  <th className="text-right text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-32" />
                )}
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr
                  key={branch.id}
                  className="border-b border-border last:border-b-0 group hover:bg-bone/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => isAdmin && setEditing(branch)}
                      className={cn(
                        'flex items-start gap-3 text-left',
                        isAdmin && 'cursor-pointer',
                      )}
                      disabled={!isAdmin}
                    >
                      <div className="w-9 h-9 rounded-lg bg-bone flex items-center justify-center text-graphite shrink-0">
                        <MapPin size={16} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-body font-medium text-dark-graphite truncate">
                          {branch.name}
                        </div>
                        {branch.address && (
                          <div className="text-caption text-mid-gray truncate">
                            {branch.address}
                          </div>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {branch.posTenantId ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-caption font-medium bg-bone text-graphite">
                        {branch.posTenantId}
                      </span>
                    ) : (
                      <span className="text-caption text-mid-gray">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-1 rounded-full text-caption font-medium',
                        branch.isActive
                          ? 'bg-positive-bg text-positive-text'
                          : 'bg-smoke text-mid-gray',
                      )}
                    >
                      {branch.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(branch)}
                          title={branch.isActive ? 'Desactivar sede' : 'Activar sede'}
                          className={cn(
                            'p-1.5 rounded-lg transition-all',
                            branch.isActive
                              ? 'text-mid-gray hover:text-graphite hover:bg-bone'
                              : 'text-positive-text hover:bg-positive-bg',
                          )}
                        >
                          <Power size={13} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(branch)}
                          title="Eliminar sede"
                          className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {branches.length === 0 && (
            <div className="px-4 py-12 text-center">
              <MapPin size={32} className="mx-auto text-mid-gray/40 mb-3" />
              <p className="text-body text-mid-gray">No hay sedes registradas</p>
              {isAdmin && (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 text-body text-graphite hover:text-dark-graphite font-medium"
                >
                  Crear la primera sede
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <BranchFormDialog
        open={createOpen || editing !== null}
        branch={editing}
        onClose={() => {
          setCreateOpen(false)
          setEditing(null)
        }}
        onSaved={loadBranches}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar sede"
        description={`¿Estas seguro de que deseas eliminar la sede "${deleteTarget?.name}"? Los registros existentes con esta sede mantienen su branchId, pero la sede dejara de aparecer en los selectores.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageTransition>
  )
}

interface BranchFormDialogProps {
  open: boolean
  branch: Branch | null
  onClose: () => void
  onSaved: () => void
}

function BranchFormDialog({ open, branch, onClose, onSaved }: BranchFormDialogProps) {
  const { selectedCompany } = useCompany()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [posTenantId, setPosTenantId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(branch?.name ?? '')
      setAddress(branch?.address ?? '')
      setPosTenantId(branch?.posTenantId ?? '')
      setIsActive(branch?.isActive ?? true)
      setError('')
    }
  }, [open, branch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre de la sede es obligatorio')
      return
    }

    const input: BranchInput = {
      name: trimmedName,
      address: address.trim() || undefined,
      posTenantId: posTenantId.trim() || undefined,
      isActive,
    }

    setLoading(true)
    setError('')
    try {
      if (branch) {
        await updateBranch(selectedCompany.id, branch.id, input)
      } else {
        await createBranch(selectedCompany.id, input)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      console.error('Error saving branch:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar la sede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full mx-4 border border-border"
          >
            <h3 className="text-subheading font-semibold text-dark-graphite mb-1">
              {branch ? 'Editar sede' : 'Nueva sede'}
            </h3>
            <p className="text-body text-mid-gray mb-5">
              {branch
                ? `Modifica los datos de ${branch.name}`
                : `Crea una sede para ${selectedCompany?.name ?? 'la empresa'}`}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Filipo Centro"
                  className={inputClass}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>Dirección (opcional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle 123 #45-67"
                  className={inputClass}
                  disabled={loading}
                />
              </div>

              <div>
                <label className={labelClass}>POS Tenant ID (opcional)</label>
                <input
                  type="text"
                  value={posTenantId}
                  onChange={(e) => setPosTenantId(e.target.value)}
                  placeholder="Ej: filipo"
                  className={inputClass}
                  disabled={loading}
                />
                <p className="text-caption text-mid-gray mt-1">
                  Identificador del tenant en el POS (debe coincidir con `pos-tenants.ts`).
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 rounded border-input-border text-graphite focus:ring-graphite/20"
                />
                <span className="text-body text-graphite">Sede activa</span>
              </label>

              {error && <p className="text-caption text-negative-text">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {branch ? 'Guardar' : 'Crear sede'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
