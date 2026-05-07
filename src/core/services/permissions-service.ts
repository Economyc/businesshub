import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import type { CompanyMember, RoleDefinition } from '@/core/types/permissions'
import { DEFAULT_ROLES } from '@/core/config/default-roles'

function membersCollection(companyId: string) {
  return collection(db, 'companies', companyId, 'members')
}

function memberDoc(companyId: string, userId: string) {
  return doc(db, 'companies', companyId, 'members', userId)
}

export async function fetchMembers(companyId: string): Promise<CompanyMember[]> {
  const snapshot = await getDocs(membersCollection(companyId))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CompanyMember)
}

export async function fetchMember(companyId: string, userId: string): Promise<CompanyMember | null> {
  const snapshot = await getDoc(memberDoc(companyId, userId))
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as CompanyMember
}

export async function createMember(
  companyId: string,
  userId: string,
  data: Omit<CompanyMember, 'id'>,
): Promise<void> {
  const now = Timestamp.now()
  await setDoc(memberDoc(companyId, userId), {
    ...data,
    joinedAt: data.joinedAt ?? now,
  })
}

export async function updateMember(
  companyId: string,
  userId: string,
  data: Partial<CompanyMember>,
): Promise<void> {
  await updateDoc(memberDoc(companyId, userId), data)
}

export async function removeMember(companyId: string, userId: string): Promise<void> {
  await deleteDoc(memberDoc(companyId, userId))
}

// ---- Roles CRUD ----

function rolesCollection(companyId: string) {
  return collection(db, 'companies', companyId, 'roles')
}

function roleDoc(companyId: string, roleId: string) {
  return doc(db, 'companies', companyId, 'roles', roleId)
}

function roleDocPayload(role: RoleDefinition) {
  return {
    label: role.label,
    description: role.description,
    color: role.color,
    isSystem: role.isSystem,
    permissions: role.permissions,
    canManageUsers: role.canManageUsers,
    canManageCompany: role.canManageCompany,
  }
}

/** Fetch all roles for a company. Seeds defaults if none exist; backfills missing system roles otherwise. */
export async function fetchRoles(companyId: string): Promise<RoleDefinition[]> {
  const snapshot = await getDocs(rolesCollection(companyId))
  if (snapshot.empty) {
    for (const role of DEFAULT_ROLES) {
      await setDoc(roleDoc(companyId, role.id), roleDocPayload(role))
    }
    return [...DEFAULT_ROLES]
  }
  const existing = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as RoleDefinition)
  const existingIds = new Set(existing.map((r) => r.id))
  const missingSystem = DEFAULT_ROLES.filter((r) => r.isSystem && !existingIds.has(r.id))
  if (missingSystem.length > 0) {
    for (const role of missingSystem) {
      await setDoc(roleDoc(companyId, role.id), roleDocPayload(role))
    }
    return [...existing, ...missingSystem]
  }
  return existing
}

export async function createRole(companyId: string, role: RoleDefinition): Promise<void> {
  await setDoc(roleDoc(companyId, role.id), {
    label: role.label,
    description: role.description,
    color: role.color,
    isSystem: role.isSystem,
    permissions: role.permissions,
    canManageUsers: role.canManageUsers,
    canManageCompany: role.canManageCompany,
  })
}

export async function updateRole(companyId: string, roleId: string, data: Partial<RoleDefinition>): Promise<void> {
  const { id, ...rest } = data as RoleDefinition & { id?: string }
  await updateDoc(roleDoc(companyId, roleId), rest)
}

export async function removeRole(companyId: string, roleId: string): Promise<void> {
  await deleteDoc(roleDoc(companyId, roleId))
}

// ---- Members ----

/** Seed the current user if no membership exists.
 *  - admin@filipoblue.co → owner
 *  - Any other authenticated user → viewer (admin can change role from UI)
 */
export async function seedMembershipIfNeeded(
  companyId: string,
  userId: string,
  email: string,
  displayName: string,
): Promise<CompanyMember | null> {
  const existing = await fetchMember(companyId, userId)
  if (existing) return existing

  const role = email === 'admin@filipoblue.co' ? 'owner' : 'viewer'

  const member: Omit<CompanyMember, 'id'> = {
    userId,
    email,
    displayName: displayName || email,
    role,
    status: 'active',
    joinedAt: Timestamp.now(),
  }

  await createMember(companyId, userId, member)
  return { id: userId, ...member } as CompanyMember
}
