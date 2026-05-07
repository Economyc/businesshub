import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBranches } from '@/core/hooks/use-branches'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { fetchMembers, updateMember, removeMember } from '@/core/services/permissions-service'
import { isBranchRole } from '@/core/types/branch'
import { ConfirmDialog } from './confirm-dialog'
import { SettingsTeamInvite } from './settings-team-invite'
import { UserAvatar } from './user-avatar'
import type { CompanyMember } from '@/core/types/permissions'

export function SettingsTeamMembers() {
  const { selectedCompany } = useCompany()
  const { member: currentMember, canManageUsers, roles, refetch } = usePermissions()
  const { activeBranches, branches } = useBranches()
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyMember | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editingBranch, setEditingBranch] = useState<string | null>(null)

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

  async function handleRoleChange(member: CompanyMember, newRole: string) {
    if (!selectedCompany) return
    const becomesBranchRole = isBranchRole(newRole)
    const wasBranchRole = isBranchRole(member.role)

    let nextBranchId: string | undefined = member.branchId
    if (becomesBranchRole && !nextBranchId && activeBranches.length > 0) {
      nextBranchId = activeBranches[0].id
    }
    if (!becomesBranchRole && wasBranchRole) {
      nextBranchId = undefined
    }

    const update: Partial<CompanyMember> = { role: newRole }
    if (becomesBranchRole) {
      update.branchId = nextBranchId
    } else if (wasBranchRole) {
      update.branchId = undefined
    }
    await updateMember(selectedCompany.id, member.userId, update)
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === member.userId ? { ...m, role: newRole, branchId: nextBranchId } : m,
      ),
    )
    setEditingRole(null)
    if (member.userId === currentMember?.userId) {
      refetch()
    }
  }

  async function handleBranchChange(member: CompanyMember, newBranchId: string) {
    if (!selectedCompany) return
    await updateMember(selectedCompany.id, member.userId, { branchId: newBranchId })
    setMembers((prev) =>
      prev.map((m) => (m.userId === member.userId ? { ...m, branchId: newBranchId } : m)),
    )
    setEditingBranch(null)
    if (member.userId === currentMember?.userId) {
      refetch()
    }
  }

  function getBranchName(branchId?: string): string | null {
    if (!branchId) return null
    const found = branches.find((b) => b.id === branchId)
    return found?.name ?? branchId
  }

  async function handleRemove() {
    if (!selectedCompany || !deleteTarget) return
    await removeMember(selectedCompany.id, deleteTarget.userId)
    setMembers((prev) => prev.filter((m) => m.userId !== deleteTarget.userId))
    setDeleteTarget(null)
  }

  function getRoleBadge(roleId: string) {
    const role = roles.find((r) => r.id === roleId)
    if (!role) return { label: roleId, color: '#6b7280' }
    return { label: role.label, color: role.color }
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
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3">
                Miembro
              </th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 hidden sm:table-cell">
                Rol
              </th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 hidden lg:table-cell">
                Sede
              </th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 hidden md:table-cell">
                Estado
              </th>
              {canManageUsers && (
                <th className="text-right text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-16" />
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const roleBadge = getRoleBadge(member.role)
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
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {editingRole === member.userId && canManageUsers && !isOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        onBlur={() => setEditingRole(null)}
                        autoFocus
                        className="text-body rounded-md border border-input-border bg-input-bg px-2 py-1 outline-none focus:border-input-focus"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => canManageUsers && !isOwner && setEditingRole(member.userId)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-medium transition-colors',
                          canManageUsers && !isOwner && 'cursor-pointer hover:opacity-80',
                        )}
                        style={{
                          backgroundColor: roleBadge.color + '15',
                          color: roleBadge.color,
                        }}
                        disabled={!canManageUsers || isOwner}
                      >
                        <Shield size={11} />
                        {roleBadge.label}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {isBranchRole(member.role) ? (
                      editingBranch === member.userId && canManageUsers ? (
                        <select
                          value={member.branchId ?? ''}
                          onChange={(e) => handleBranchChange(member, e.target.value)}
                          onBlur={() => setEditingBranch(null)}
                          autoFocus
                          className="text-body rounded-md border border-input-border bg-input-bg px-2 py-1 outline-none focus:border-input-focus"
                        >
                          {activeBranches.length === 0 && <option value="">— sin sedes —</option>}
                          {activeBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => canManageUsers && setEditingBranch(member.userId)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-medium bg-bone text-graphite',
                            canManageUsers && 'cursor-pointer hover:opacity-80',
                            !member.branchId && 'text-negative-text bg-red-50',
                          )}
                          disabled={!canManageUsers}
                        >
                          <MapPin size={11} />
                          {getBranchName(member.branchId) ?? 'Sin asignar'}
                        </button>
                      )
                    ) : (
                      <span className="text-caption text-mid-gray">—</span>
                    )}
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
                  {canManageUsers && (
                    <td className="px-4 py-3 text-right">
                      {!isSelf && !isOwner && (
                        <button
                          onClick={() => setDeleteTarget(member)}
                          className="p-1.5 rounded-lg text-mid-gray hover:text-negative-text hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
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
        description={`¿Estas seguro de que deseas eliminar a "${deleteTarget?.displayName || deleteTarget?.email}" del equipo? Perdera acceso a esta compañia.`}
        onConfirm={handleRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
