import { useState } from 'react'
import { Shield, Trash2, ChevronRight, X, Plus, Loader2, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { createRole, updateRole, removeRole } from '@/core/services/permissions-service'
import { ACCESS_REGISTRY, getMatrixPages } from '@/core/config/access-registry'
import { Switch } from '@/components/ui/switch'
import { PageTransition } from './page-transition'
import { PageHeader } from './page-header'
import { ConfirmDialog } from './confirm-dialog'
import type { PermissionAction, RoleDefinition, RolePermissions } from '@/core/types/permissions'

const ALL_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']
const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
}

const ROLE_COLORS = ['#1a1a2e', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6b7280', '#ec4899']

function emptyPerms(): RolePermissions {
  return { pages: {}, tabs: {} }
}

function clonePerms(p: RolePermissions): RolePermissions {
  return {
    pages: Object.fromEntries(Object.entries(p.pages ?? {}).map(([k, v]) => [k, [...v]])),
    tabs: { ...(p.tabs ?? {}) },
  }
}

function RolePermissionSheet({
  role,
  onClose,
  onSave,
  onDelete,
}: {
  role: RoleDefinition
  onClose: () => void
  onSave: (updated: RoleDefinition) => Promise<void>
  onDelete?: () => void
}) {
  const isOwnerRole = role.id === 'owner'
  const [draft, setDraft] = useState<RoleDefinition>(() => ({
    ...role,
    permissions: clonePerms(role.permissions ?? emptyPerms()),
  }))
  const [saving, setSaving] = useState(false)
  const hasChanges = JSON.stringify(draft) !== JSON.stringify({ ...role, permissions: role.permissions ?? emptyPerms() })

  function pageActions(pageId: string): PermissionAction[] {
    return draft.permissions.pages[pageId] ?? []
  }

  function setAction(pageId: string, action: PermissionAction, on: boolean) {
    if (isOwnerRole) return
    setDraft((prev) => {
      const current = new Set(prev.permissions.pages[pageId] ?? [])
      if (on) {
        current.add(action)
        // No se puede crear/editar/eliminar sin poder ver.
        if (action !== 'read') current.add('read')
      } else {
        current.delete(action)
        // Sin "ver" no hay acceso: se vacía la página.
        if (action === 'read') current.clear()
      }
      const next = ALL_ACTIONS.filter((a) => current.has(a))
      const pages = { ...prev.permissions.pages }
      if (next.length === 0) delete pages[pageId]
      else pages[pageId] = next
      return { ...prev, permissions: { ...prev.permissions, pages } }
    })
  }

  function setTab(tabId: string, on: boolean) {
    if (isOwnerRole) return
    setDraft((prev) => {
      const tabs = { ...prev.permissions.tabs }
      if (on) tabs[tabId] = true
      else delete tabs[tabId]
      return { ...prev, permissions: { ...prev.permissions, tabs } }
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const canManageUsers = (draft.permissions.pages['settings.team'] ?? []).some((a) => a !== 'read')
      const canManageCompany = (draft.permissions.pages['settings.companies'] ?? []).some((a) => a !== 'read')
      await onSave({ ...draft, canManageUsers, canManageCompany })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-y-0 right-0 w-full max-w-3xl bg-surface-elevated border-l border-border z-50 flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-elevated border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: draft.color + '20' }}>
            <Shield size={16} style={{ color: draft.color }} />
          </div>
          <div className="min-w-0 flex-1">
            {isOwnerRole ? (
              <h3 className="text-subheading font-medium text-dark-graphite">{draft.label}</h3>
            ) : (
              <input
                value={draft.label}
                onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                className="text-subheading font-medium text-dark-graphite bg-transparent outline-none w-full border-b border-transparent focus:border-input-focus transition-colors"
                placeholder="Nombre del rol"
              />
            )}
            {isOwnerRole ? (
              <p className="text-caption text-mid-gray">{draft.description}</p>
            ) : (
              <input
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                className="text-caption text-mid-gray bg-transparent outline-none w-full border-b border-transparent focus:border-input-focus transition-colors"
                placeholder="Descripción"
              />
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {isOwnerRole && (
          <div className="flex items-center gap-2 rounded-lg bg-bone px-3 py-2.5 text-caption text-mid-gray">
            <Lock size={13} strokeWidth={1.5} />
            El Propietario tiene acceso total a todo (incluido lo que se agregue). No editable.
          </div>
        )}

        {/* Color picker */}
        {!isOwnerRole && (
          <div>
            <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-2">Color</h4>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((p) => ({ ...p, color: c }))}
                  className={cn('w-7 h-7 rounded-full transition-all', draft.color === c && 'ring-2 ring-offset-2 ring-graphite')}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Permission matrix */}
        {ACCESS_REGISTRY.map((mod) => {
          const pages = mod.pages.filter((p) => !p.matrixHidden)
          if (pages.length === 0) return null
          return (
            <div key={mod.id}>
              <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-3">{mod.label}</h4>
              <div className="rounded-xl bg-bone/50 overflow-hidden divide-y divide-border/40">
                {pages.map((page) => {
                  const actions = isOwnerRole ? page.actions : pageActions(page.id)
                  return (
                    <div key={page.id} className="px-4 py-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-body font-medium text-dark-graphite">{page.label}</div>
                        <div className="flex items-center gap-3 flex-wrap justify-end">
                          {page.actions.map((action) => (
                            <label key={action} className="flex items-center gap-1.5">
                              <Switch
                                size="sm"
                                checked={isOwnerRole ? true : actions.includes(action)}
                                onCheckedChange={(on) => setAction(page.id, action, on)}
                                disabled={isOwnerRole}
                                aria-label={`${page.label} ${ACTION_LABELS[action]}`}
                              />
                              <span className="text-caption text-mid-gray">{ACTION_LABELS[action]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      {page.tabs && page.tabs.length > 0 && (
                        <div className="pl-3 border-l border-border/60 flex flex-col gap-2">
                          {page.tabs.map((tab) => (
                            <label key={tab.id} className="flex items-center justify-between gap-3">
                              <span className="text-caption text-graphite">{tab.label}</span>
                              <Switch
                                size="sm"
                                checked={isOwnerRole ? true : draft.permissions.tabs[tab.id] === true}
                                onCheckedChange={(on) => setTab(tab.id, on)}
                                disabled={isOwnerRole}
                                aria-label={`Tab ${tab.label}`}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Delete custom role */}
        {onDelete && !role.isSystem && (
          <div className="pt-4 border-t border-border">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body font-medium text-negative-text border border-border/60 hover:bg-negative-bg transition-all duration-200"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Eliminar rol
            </button>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {hasChanges && !isOwnerRole && (
        <div className="sticky bottom-0 bg-surface-elevated border-t border-border px-5 py-3 flex items-center justify-between">
          <span className="text-caption text-mid-gray">Cambios sin guardar</span>
          <div className="flex gap-2">
            <button
              onClick={() => setDraft({ ...role, permissions: clonePerms(role.permissions ?? emptyPerms()) })}
              className="px-3 py-1.5 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !draft.label.trim()}
              className="px-4 py-1.5 rounded-lg text-body font-medium btn-primary transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function RolesManager() {
  const { selectedCompany } = useCompany()
  const { roles, canManageUsers, refetchRoles } = usePermissions()
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null)
  const [creating, setCreating] = useState(false)

  const totalPages = getMatrixPages().length

  async function handleSaveRole(updated: RoleDefinition) {
    if (!selectedCompany) return
    await updateRole(selectedCompany.id, updated.id, updated)
    await refetchRoles()
  }

  async function handleCreateRole() {
    if (!selectedCompany) return
    setCreating(true)
    const newRole: RoleDefinition = {
      id: `custom_${Date.now()}`,
      label: 'Nuevo rol',
      description: 'Descripción del rol',
      color: '#6b7280',
      isSystem: false,
      permissions: emptyPerms(),
      canManageUsers: false,
      canManageCompany: false,
    }
    try {
      await createRole(selectedCompany.id, newRole)
      await refetchRoles()
      setSelectedRole(newRole)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteRole() {
    if (!selectedCompany || !deleteTarget) return
    await removeRole(selectedCompany.id, deleteTarget.id)
    await refetchRoles()
    setDeleteTarget(null)
  }

  return (
    <>
      {canManageUsers && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleCreateRole}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2} />}
            Crear rol
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => {
          const isOwnerRole = role.id === 'owner'
          const accessible = isOwnerRole
            ? totalPages
            : Object.values(role.permissions?.pages ?? {}).filter((a) => a.length > 0).length
          return (
            <div key={role.id} className="text-left bg-surface card-elevated rounded-xl p-4 hover:border-border-hover transition-colors duration-200 group relative">
              <button onClick={() => setSelectedRole(role)} className="w-full text-left">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: role.color + '15' }}>
                    <Shield size={18} style={{ color: role.color }} />
                  </div>
                  <ChevronRight size={14} className="text-mid-gray/40 group-hover:text-graphite transition-colors mt-1" />
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold mb-2" style={{ backgroundColor: role.color + '15', color: role.color }}>
                  {role.label}
                </div>
                <p className="text-caption text-mid-gray line-clamp-2 mb-3">{role.description}</p>
                <div className="text-caption text-mid-gray/80">
                  {isOwnerRole ? 'Acceso total a todo' : `${accessible} de ${totalPages} páginas`}
                </div>
              </button>

              {!role.isSystem && canManageUsers && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-negative-bg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedRole && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setSelectedRole(null)}
            />
            <RolePermissionSheet
              role={selectedRole}
              onClose={() => setSelectedRole(null)}
              onSave={handleSaveRole}
              onDelete={!selectedRole.isSystem && canManageUsers ? () => { setDeleteTarget(selectedRole); setSelectedRole(null) } : undefined}
            />
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar rol"
        description={`¿Estás seguro de que deseas eliminar el rol "${deleteTarget?.label}"? Los usuarios con este rol perderán su acceso.`}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}

export function SettingsRoles() {
  return (
    <PageTransition>
      <PageHeader title="Roles" />
      <RolesManager />
    </PageTransition>
  )
}
