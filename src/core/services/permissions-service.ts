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

/** Fetch all roles for a company. Seeds defaults if none exist. */
export async function fetchRoles(companyId: string): Promise<RoleDefinition[]> {
  const snapshot = await getDocs(rolesCollection(companyId))
  if (snapshot.empty) {
    // Seed default roles
    for (const role of DEFAULT_ROLES) {
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
    return [...DEFAULT_ROLES]
  }
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as RoleDefinition)
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

/** Seed the current user if no membership exists */
export async function seedMembershipIfNeeded(
  companyId: string,
  userId: string,
  email: string,
  displayName: string,
): Promise<CompanyMember | null> {
  const existing = await fetchMember(companyId, userId)
  if (existing) return existing

  let role: string | null = null

  if (email === 'admin@filipoblue.co') {
    role = 'owner'
  } else if (email === 'lomas@bluesb.co' || email === 'manila@bluesb.co') {
    // Find the "Líder de Punto" role by label
    const roles = await fetchRoles(companyId)
    const liderRole = roles.find((r) => r.label.toLowerCase().includes('lider') || r.label.toLowerCase().includes('líder'))
    role = liderRole?.id ?? 'viewer'
  }

  if (!role) return null

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
