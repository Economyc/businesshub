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
import { httpsCallable } from 'firebase/functions'
import { db, getAppFunctions } from '@/core/firebase/config'
import type { CompanyMember, ModulePermission, RoleDefinition, RolePermissions } from '@/core/types/permissions'
import { DEFAULT_ROLES } from '@/core/config/default-roles'
import { migrateLegacyPermissions, defaultPermissionsOff, OWNER_EMAIL } from '@/core/config/access-registry'

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

/** Normaliza un doc de rol a la forma actual `RolePermissions`, migrando si viene
 *  en la forma vieja (`ModulePermission[]`). No reescribe Firestore en la lectura. */
function normalizeRole(raw: Record<string, unknown> & { id: string }): RoleDefinition {
  const rawPerms = raw.permissions
  let permissions: RolePermissions

  if (Array.isArray(rawPerms)) {
    // Forma vieja. Para roles de sistema, usar el default nuevo; el resto se migra.
    const def = DEFAULT_ROLES.find((r) => r.id === raw.id)
    permissions = def ? def.permissions : migrateLegacyPermissions(rawPerms as ModulePermission[])
  } else if (rawPerms && typeof rawPerms === 'object') {
    const p = rawPerms as Partial<RolePermissions>
    permissions = { pages: p.pages ?? {}, tabs: p.tabs ?? {} }
  } else {
    permissions = defaultPermissionsOff()
  }

  return { ...(raw as unknown as RoleDefinition), permissions }
}

function roleToDoc(role: RoleDefinition) {
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

/** Fetch all roles for a company. Seeds defaults if none exist. */
export async function fetchRoles(companyId: string): Promise<RoleDefinition[]> {
  const snapshot = await getDocs(rolesCollection(companyId))
  if (snapshot.empty) {
    // Seed default roles
    for (const role of DEFAULT_ROLES) {
      await setDoc(roleDoc(companyId, role.id), roleToDoc(role))
    }
    return [...DEFAULT_ROLES]
  }
  return snapshot.docs.map((d) => normalizeRole({ id: d.id, ...d.data() }))
}

export async function createRole(companyId: string, role: RoleDefinition): Promise<void> {
  await setDoc(roleDoc(companyId, role.id), roleToDoc(role))
}

export async function updateRole(
  companyId: string,
  roleId: string,
  data: Partial<RoleDefinition>,
): Promise<void> {
  const { id: _id, ...rest } = data as RoleDefinition & { id?: string }
  void _id
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

  const role = email.toLowerCase() === OWNER_EMAIL ? 'owner' : 'viewer'

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

// ---- Admin callables (mutate Firebase Auth + Firestore) ----

export async function adminCreateUserCallable(input: {
  companyId: string
  email: string
  password: string
  displayName: string
  role: string
}): Promise<{ uid: string }> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<typeof input, { uid: string }>(functions, 'adminCreateUser')
  const result = await fn(input)
  return result.data
}

export async function adminSetUserStatusCallable(input: {
  companyId: string
  userId: string
  status: 'active' | 'suspended'
}): Promise<void> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<typeof input, { ok: boolean }>(functions, 'adminSetUserStatus')
  await fn(input)
}

export async function adminDeleteUserCallable(input: {
  companyId: string
  userId: string
}): Promise<void> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<typeof input, { ok: boolean }>(functions, 'adminDeleteUser')
  await fn(input)
}
