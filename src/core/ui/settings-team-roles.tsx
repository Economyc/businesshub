import { useState } from 'react'
import { Shield, Trash2, ChevronRight, X, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { createRole, updateRole, removeRole } from '@/core/services/permissions-service'
import { ConfirmDialog } from './confirm-dialog'
import type { RoleDefinition, ModuleKey, PermissionAction } from '@/core/types/permissions'
import { motion, AnimatePresence } from 'framer-motion'

const ALL_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']

const MODULE_GROUPS: { title: string; modules: { key: ModuleKey; label: string; description: string }[] }[] = [
  {
    title: 'General',
    modules: [
      { key: 'home', label: 'Home', description: 'Panel principal con resumen general' },
      { key: 'analytics', label: 'Analisis', description: 'Dashboards, reportes y metricas' },
      { key: 'agent', label: 'Asistente AI', description: 'Chat con el asistente inteligente' },
    ],
  },
  {
    title: 'Contabilidad',
    modules: [
      { key: 'finance', label: 'Finanzas', description: 'Transacciones, flujo de caja, presupuesto, conciliacion' },
      { key: 'cartera', label: 'Cartera', description: 'Cuentas por cobrar y por pagar' },
      { key: 'closings', label: 'Cierres de Caja', description: 'Cierres diarios y descuentos' },
      { key: 'payroll', label: 'Nomina', description: 'Calculo y gestion de nomina' },
      { key: 'prestaciones', label: 'Prestaciones', description: 'Liquidaciones y beneficios laborales' },
    ],
  },
  {
    title: 'Gestion',
    modules: [
      { key: 'contracts', label: 'Contratos', description: 'Contratos laborales y plantillas' },
      { key: 'partners', label: 'Socios', description: 'Socios y participacion accionaria' },
    ],
  },
  {
    title: 'Personas',
    modules: [
      { key: 'talent', label: 'Equipo', description: 'Empleados, documentos y perfiles' },
      { key: 'suppliers', label: 'Proveedores', description: 'Proveedores y contactos' },
    ],
  },
  {
    title: 'Sistema',
    modules: [
      { key: 'settings', label: 'Configuracion', description: 'Compañias, categorias, cargos, departamentos y equipo' },
    ],
  },
]

const ROLE_COLORS = ['#1a1a2e', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6b7280', '#ec4899']

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0',
        checked ? 'bg-green-500' : 'bg-smoke',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-[18px]' : 'translate-x-0.5',
      )} />
    </button>
  )
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
  const [draft, setDraft] = useState<RoleDefinition>(() => JSON.parse(JSON.stringify(role)))
  const [saving, setSaving] = useState(false)
  const isOwnerRole = role.id === 'owner'
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(role)

  function toggleModule(moduleKey: ModuleKey) {
    if (isOwnerRole) return

    setDraft((prev) => {
      const perms = [...prev.permissions]
      const idx = perms.findIndex((p) => p.module === moduleKey)

      if (idx === -1) {
        // Enable: grant full access
        perms.push({ module: moduleKey, actions: [...ALL_ACTIONS] })
      } else {
        // Disable: remove entirely
        perms.splice(idx, 1)
      }

      return { ...prev, permissions: perms }
    })
  }

  function hasModule(moduleKey: ModuleKey) {
    return draft.permissions.some((p) => p.module === moduleKey)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Sync canManageUsers/canManageCompany with settings access
      const hasSettings = draft.permissions.some((p) => p.module === 'settings')
      const updated = {
        ...draft,
        canManageUsers: hasSettings,
        canManageCompany: hasSettings,
      }
      await onSave(updated)
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
      className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-elevated border-l border-border shadow-lg z-50 flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-elevated border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: draft.color + '20' }}
          >
            <Shield size={16} style={{ color: draft.color }} />
          </div>
          <div className="min-w-0 flex-1">
            {isOwnerRole ? (
              <h3 className="text-subheading font-semibold text-dark-graphite">{draft.label}</h3>
            ) : (
              <input
                value={draft.label}
                onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                className="text-subheading font-semibold text-dark-graphite bg-transparent outline-none w-full border-b border-transparent focus:border-input-focus transition-colors"
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
                placeholder="Descripcion"
              />
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Color picker */}
        {!isOwnerRole && (
          <div>
            <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-2">Color</h4>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft((p) => ({ ...p, color: c }))}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    draft.color === c && 'ring-2 ring-offset-2 ring-graphite',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Module access toggles */}
        {MODULE_GROUPS.map((group) => (
          <div key={group.title}>
            <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-3">
              {group.title}
            </h4>
            <div className="rounded-xl bg-bone/50 overflow-hidden divide-y divide-border/30">
              {group.modules.map((mod) => (
                <div key={mod.key} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-body font-medium text-dark-graphite">{mod.label}</div>
                    <div className="text-caption text-mid-gray">{mod.description}</div>
                  </div>
                  <Toggle
                    checked={hasModule(mod.key)}
                    onChange={() => toggleModule(mod.key)}
                    disabled={isOwnerRole}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Delete button for custom roles */}
        {onDelete && !role.isSystem && (
          <div className="pt-4 border-t border-border">
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-body font-medium text-negative-text border border-red-200 hover:bg-red-50 transition-all duration-200"
            >
              <Trash2 size={14} />
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
              onClick={() => setDraft(JSON.parse(JSON.stringify(role)))}
              className="px-3 py-1.5 rounded-[10px] text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !draft.label.trim()}
              className="px-4 py-1.5 rounded-[10px] text-body font-medium btn-primary transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-40 flex items-center gap-1.5"
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

export function SettingsTeamRoles() {
  const { selectedCompany } = useCompany()
  const { roles, canManageUsers, refetchRoles } = usePermissions()
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleSaveRole(updated: RoleDefinition) {
    if (!selectedCompany) return
    await updateRole(selectedCompany.id, updated.id, updated)
    await refetchRoles()
  }

  async function handleCreateRole() {
    if (!selectedCompany) return
    setCreating(true)
    const id = `custom_${Date.now()}`
    const newRole: RoleDefinition = {
      id,
      label: 'Nuevo rol',
      description: 'Descripcion del rol',
      color: '#6b7280',
      isSystem: false,
      permissions: [{ module: 'home', actions: [...ALL_ACTIONS] }],
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
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-40"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2} />}
            Crear rol
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => {
          const moduleCount = role.permissions.length
          const totalModules = 13
          const hasFullAccess = moduleCount === totalModules

          return (
            <div
              key={role.id}
              className="text-left bg-surface card-elevated rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-px group relative"
            >
              <button
                onClick={() => setSelectedRole(role)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: role.color + '15' }}
                  >
                    <Shield size={18} style={{ color: role.color }} />
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-mid-gray/40 group-hover:text-graphite transition-colors mt-1"
                  />
                </div>
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold mb-2"
                  style={{ backgroundColor: role.color + '15', color: role.color }}
                >
                  {role.label}
                </div>
                <p className="text-caption text-mid-gray line-clamp-2 mb-3">
                  {role.description}
                </p>
                <div className="text-caption text-mid-gray/80">
                  {hasFullAccess ? 'Acceso a todos los modulos' : `Acceso a ${moduleCount} de ${totalModules} modulos`}
                </div>
              </button>

              {/* Delete button for custom roles */}
              {!role.isSystem && canManageUsers && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
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
              onDelete={!selectedRole.isSystem && canManageUsers ? () => {
                setDeleteTarget(selectedRole)
                setSelectedRole(null)
              } : undefined}
            />
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar rol"
        description={`¿Estas seguro de que deseas eliminar el rol "${deleteTarget?.label}"? Los usuarios con este rol perderan su acceso.`}
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
