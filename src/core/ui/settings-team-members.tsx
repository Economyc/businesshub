import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, Ban, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import {
  fetchMembers,
  adminDeleteUserCallable,
  adminSetUserStatusCallable,
  adminSetMemberRoleCallable,
} from '@/core/services/permissions-service'
import { ConfirmDialog } from './confirm-dialog'
import { SettingsTeamInvite } from './settings-team-invite'
import { SelectInput } from './select-input'
import { UserAvatar } from './user-avatar'
import type { CompanyMember } from '@/core/types/permissions'

export function SettingsTeamMembers() {
  const { selectedCompany } = useCompany()
  const { member: currentMember, canManageUsers, roles } = usePermissions()
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.label }))
  const roleLabel = (roleId: string) => roles.find((r) => r.id === roleId)?.label ?? roleId
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyMember | null>(null)
  const [statusTarget, setStatusTarget] = useState<{ member: CompanyMember; status: 'active' | 'suspended' } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function loadMembers() {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const data = await fetchMembers(selectedCompany.id)
      setMembers(data)
    } catch (err) {
      console.error('Error loading members:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [selectedCompany?.id])

  async function handleRemove() {
    if (!selectedCompany || !deleteTarget) return
    try {
      await adminDeleteUserCallable({
        companyId: selectedCompany.id,
        userId: deleteTarget.userId,
      })
      setMembers((prev) => prev.filter((m) => m.userId !== deleteTarget.userId))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Error deleting member:', err)
      setActionError(err instanceof Error ? err.message : 'Error al eliminar')
      setDeleteTarget(null)
    }
  }

  async function handleRoleChange(target: CompanyMember, roleId: string) {
    if (!selectedCompany || roleId === target.role) return
    try {
      await adminSetMemberRoleCallable({
        companyId: selectedCompany.id,
        userId: target.userId,
        roleId,
      })
      setMembers((prev) => prev.map((m) => (m.userId === target.userId ? { ...m, role: roleId } : m)))
    } catch (err) {
      console.error('Error changing role:', err)
      setActionError(err instanceof Error ? err.message : 'Error al cambiar el rol')
    }
  }

  async function handleStatusChange() {
    if (!selectedCompany || !statusTarget) return
    try {
      await adminSetUserStatusCallable({
        companyId: selectedCompany.id,
        userId: statusTarget.member.userId,
        status: statusTarget.status,
      })
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === statusTarget.member.userId ? { ...m, status: statusTarget.status } : m,
        ),
      )
      setStatusTarget(null)
    } catch (err) {
      console.error('Error changing status:', err)
      setActionError(err instanceof Error ? err.message : 'Error al cambiar estado')
      setStatusTarget(null)
    }
  }

  function getStatusBadge(status: CompanyMember['status']) {
    switch (status) {
      case 'active':
        return { label: 'Activo', className: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
      case 'invited':
        return { label: 'Invitado', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
      case 'suspended':
        return { label: 'Suspendido', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-smoke animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {canManageUsers && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            <Plus size={14} strokeWidth={2} />
            Invitar miembro
          </button>
        </div>
      )}

      <div className="rounded-xl bg-surface card-elevated overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3">
                Miembro
              </th>
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 hidden md:table-cell">
                Estado
              </th>
              <th className="text-left text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 hidden md:table-cell">
                Rol
              </th>
              {canManageUsers && (
                <th className="text-right text-caption uppercase tracking-wider font-semibold text-mid-gray px-4 py-3 w-24" />
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const statusBadge = getStatusBadge(member.status)
              const isSelf = member.userId === currentMember?.userId
              const isOwner = member.role === 'owner'

              return (
                <tr
                  key={member.userId}
                  className="border-b border-border last:border-b-0 group hover:bg-bone/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        displayName={member.displayName}
                        email={member.email}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-body font-medium text-dark-graphite truncate">
                          {member.displayName || member.email.split('@')[0]}
                          {isSelf && (
                            <span className="text-caption text-mid-gray ml-1.5">(tu)</span>
                          )}
                        </div>
                        <div className="text-caption text-mid-gray truncate">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-1 rounded-full text-caption font-medium',
                        statusBadge.className,
                      )}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {canManageUsers && !isOwner && !isSelf ? (
                      <SelectInput
                        value={member.role}
                        onChange={(v) => handleRoleChange(member, v)}
                        options={roleOptions}
                        className="min-w-[150px]"
                      />
                    ) : (
                      <span className="text-body text-graphite">{roleLabel(member.role)}</span>
                    )}
                  </td>
                  {canManageUsers && (
                    <td className="px-4 py-3 text-right">
                      {!isSelf && !isOwner && (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {member.status === 'suspended' ? (
                            <button
                              onClick={() => setStatusTarget({ member, status: 'active' })}
                              title="Reactivar"
                              className="p-1.5 rounded-lg text-mid-gray hover:text-green-700 hover:bg-green-50 transition-all"
                            >
                              <UserCheck size={13} strokeWidth={1.5} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setStatusTarget({ member, status: 'suspended' })}
                              title="Suspender"
                              className="p-1.5 rounded-lg text-mid-gray hover:text-amber-700 hover:bg-amber-50 transition-all"
                            >
                              <Ban size={13} strokeWidth={1.5} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteTarget(member)}
                            title="Eliminar"
                            className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {members.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Shield size={32} className="mx-auto text-mid-gray/40 mb-3" />
            <p className="text-body text-mid-gray">No hay miembros en este equipo</p>
            {canManageUsers && (
              <button
                onClick={() => setInviteOpen(true)}
                className="mt-3 text-body text-graphite hover:text-dark-graphite font-medium"
              >
                Invitar al primer miembro
              </button>
            )}
          </div>
        )}
      </div>

      <SettingsTeamInvite
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={loadMembers}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar miembro"
        description={`¿Estás seguro de que deseas eliminar a "${deleteTarget?.displayName || deleteTarget?.email}" del equipo? Esto borrará su cuenta de acceso permanentemente.`}
        onConfirm={handleRemove}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={statusTarget !== null}
        title={statusTarget?.status === 'suspended' ? 'Suspender miembro' : 'Reactivar miembro'}
        description={
          statusTarget?.status === 'suspended'
            ? `Suspender a "${statusTarget?.member.displayName || statusTarget?.member.email}". No podrá iniciar sesión hasta que lo reactives.`
            : `Reactivar a "${statusTarget?.member.displayName || statusTarget?.member.email}". Podrá iniciar sesión de nuevo.`
        }
        confirmLabel={statusTarget?.status === 'suspended' ? 'Suspender' : 'Reactivar'}
        loadingLabel="Aplicando..."
        variant={statusTarget?.status === 'suspended' ? 'danger' : 'neutral'}
        onConfirm={handleStatusChange}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        open={actionError !== null}
        title="Error"
        description={actionError ?? ''}
        confirmLabel="Cerrar"
        loadingLabel="Cerrando..."
        variant="neutral"
        onConfirm={() => setActionError(null)}
        onCancel={() => setActionError(null)}
      />
    </>
  )
}
