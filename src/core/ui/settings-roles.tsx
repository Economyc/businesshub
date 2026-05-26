import { useState } from 'react'
import { Shield, Trash2, ChevronRight, Plus, Loader2, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { createRole, updateRole, removeRole, replicateRoleToAllowedCompanies } from '@/core/services/permissions-service'
import { getMatrixPages } from '@/core/config/access-registry'
import { PageTransition } from './page-transition'
import { PageHeader } from './page-header'
import { ConfirmDialog } from './confirm-dialog'
import { RoleEditorDialog } from './role-editor-dialog'
import type { RoleDefinition, RolePermissions } from '@/core/types/permissions'

function emptyPerms(): RolePermissions {
  return { pages: {}, tabs: {} }
}

function RolesManager() {
  const { selectedCompany, allCompanies } = useCompany()
  const { roles, refetchRoles } = usePermissions()
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null)
  const [creating, setCreating] = useState(false)

  const totalPages = getMatrixPages().length
  const totalCompanies = allCompanies.length

  async function handleSaveRole(updated: RoleDefinition) {
    if (!selectedCompany) return
    await updateRole(selectedCompany.id, updated.id, updated)
    // Si el rol tiene allowedCompanyIds, replicamos el doc completo en cada
    // company del array. Sin esto, un usuario invitado en otra company con
    // este rol no encontraría el doc del rol allí y el filtro se rompería
    // (cayendo a "sin restricción" en esa company).
    await replicateRoleToAllowedCompanies(updated)
    await refetchRoles()
  }

  async function handleCreateRole() {
    if (!selectedCompany) return
    setCreating(true)
    // Default seguro: `[]` = ninguna empresa permitida. El owner debe entrar
    // y elegir explícitamente "Acceso a todas" o seleccionar empresas. Así
    // un rol recién creado no le da acceso accidental a nadie.
    const newRole: RoleDefinition = {
      id: `custom_${Date.now()}`,
      label: 'Nuevo rol',
      description: 'Descripción del rol',
      color: '#6b7280',
      isSystem: false,
      permissions: emptyPerms(),
      canManageUsers: false,
      canManageCompany: false,
      allowedCompanyIds: [],
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => {
          const isOwnerRole = role.id === 'owner'
          const accessiblePages = isOwnerRole
            ? totalPages
            : Object.values(role.permissions?.pages ?? {}).filter((a) => a.length > 0).length
          const allowedCount = role.allowedCompanyIds?.length ?? 0
          // Semántica: undefined = todas, [] = ninguna, lista = solo esas.
          const allCompaniesAllowed = role.allowedCompanyIds === undefined
          const noneAllowed = Array.isArray(role.allowedCompanyIds) && allowedCount === 0
          return (
            <div
              key={role.id}
              className="text-left bg-surface card-elevated rounded-xl p-4 hover:border-border-hover transition-colors duration-200 group relative"
            >
              <button onClick={() => setSelectedRole(role)} className="w-full text-left">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: role.color + '15' }}
                  >
                    <Shield size={18} style={{ color: role.color }} />
                  </div>
                  <ChevronRight size={14} className="text-mid-gray/40 group-hover:text-graphite transition-colors mt-1" />
                </div>
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold mb-2"
                  style={{ backgroundColor: role.color + '15', color: role.color }}
                >
                  {role.label}
                </div>
                <p className="text-caption text-mid-gray line-clamp-2 mb-3">{role.description}</p>
                <div className="flex items-center justify-between gap-2 text-caption text-mid-gray/80">
                  <span>
                    {isOwnerRole ? 'Acceso total' : `${accessiblePages} de ${totalPages} páginas`}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      noneAllowed && !isOwnerRole && 'text-negative-text',
                    )}
                  >
                    <Building2 size={11} strokeWidth={1.5} />
                    {isOwnerRole || allCompaniesAllowed
                      ? `Todas (${totalCompanies})`
                      : noneAllowed
                      ? 'Ninguna'
                      : `${allowedCount} ${allowedCount === 1 ? 'empresa' : 'empresas'}`}
                  </span>
                </div>
              </button>

              {!role.isSystem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(role)
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-negative-bg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selectedRole && (
        <RoleEditorDialog
          key={selectedRole.id}
          role={selectedRole}
          companies={allCompanies}
          open
          onClose={() => setSelectedRole(null)}
          onSave={handleSaveRole}
          onDelete={
            !selectedRole.isSystem
              ? () => {
                  setDeleteTarget(selectedRole)
                  setSelectedRole(null)
                }
              : undefined
          }
        />
      )}

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
      <PageHeader title="Cargos" />
      <RolesManager />
    </PageTransition>
  )
}
