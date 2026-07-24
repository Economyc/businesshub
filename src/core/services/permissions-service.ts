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

/**
 * @deprecated Desde jul-2026 las reglas de Firestore niegan `update` sobre
 * `companies/{id}/members/**` desde el cliente: era la vía por la que cualquier
 * usuario podía escribirse `role: 'owner'` (hallazgos F1/F7 del escaneo).
 * Usar `adminSetMemberRoleCallable` / `adminSetUserStatusCallable`.
 */
export async function updateMember(
  companyId: string,
  userId: string,
  data: Partial<CompanyMember>,
): Promise<void> {
  await updateDoc(memberDoc(companyId, userId), data)
}

/** @deprecated Las reglas niegan `delete` desde el cliente. Usar `adminDeleteUserCallable`. */
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
  const doc: Record<string, unknown> = {
    label: role.label,
    description: role.description,
    color: role.color,
    isSystem: role.isSystem,
    permissions: role.permissions,
    canManageUsers: role.canManageUsers,
    canManageCompany: role.canManageCompany,
  }
  // Semántica:
  //  - `undefined`     → sin restricción (todas las empresas presentes y futuras).
  //  - `[]`            → ninguna empresa (rol "vacío" que bloquea a sus usuarios).
  //  - `[id1, id2]`    → solo esas.
  // Persistimos el array (incluso vacío) cuando está definido, porque la
  // diferencia entre "todas" y "ninguna" es crítica.
  if (Array.isArray(role.allowedCompanyIds)) {
    doc.allowedCompanyIds = role.allowedCompanyIds
  }
  return doc
}

/**
 * Resuelve si una company está permitida para un rol.
 * - Rol sin `allowedCompanyIds` (undefined) → sin restricción, true.
 * - Rol con `allowedCompanyIds = []` → ninguna company permitida.
 * - Rol con lista → la company debe estar en la lista.
 */
export function isCompanyAllowedForRole(
  companyId: string,
  role: Pick<RoleDefinition, 'allowedCompanyIds'> | null | undefined,
): boolean {
  if (!role) return true
  const list = role.allowedCompanyIds
  if (list === undefined) return true
  return list.includes(companyId)
}

/**
 * Replica un rol en todas las companies de `allowedCompanyIds`. Necesario
 * porque cada company guarda su propia copia de roles: si el owner crea
 * "Blue Staff" en Blue Manila y lo restringe a [manila, oculta], el doc
 * también debe existir en Blue Oculta para que el `loadAccess` del provider
 * encuentre el rol al validar el membership de un usuario en esa company.
 *
 * Se hace con `setDoc` (merge=false): el rol se sobreescribe completo en
 * cada destino, garantizando que `allowedCompanyIds` esté igual en todos.
 * No-op si la lista es undefined (sin restricción) o vacía (sin destinos).
 */
export async function replicateRoleToAllowedCompanies(role: RoleDefinition): Promise<void> {
  const targets = role.allowedCompanyIds
  if (!Array.isArray(targets) || targets.length === 0) return
  await Promise.all(
    targets.map((cid) => setDoc(roleDoc(cid, role.id), roleToDoc(role))),
  )
}

/** Fetch all roles for a company. Seeds defaults if none exist. */
export async function fetchRoles(companyId: string): Promise<RoleDefinition[]> {
  const snapshot = await getDocs(rolesCollection(companyId))
  if (snapshot.empty) {
    // Seed default roles. Desde jul-2026 las reglas restringen la escritura de
    // `companies/{id}/roles/**` al owner, así que para un miembro común el seed
    // falla. En ese caso devolvemos los defaults en memoria: sin esto, entrar a
    // una compañía sin roles sembrados rompería toda la carga de permisos.
    try {
      for (const role of DEFAULT_ROLES) {
        await setDoc(roleDoc(companyId, role.id), roleToDoc(role))
      }
    } catch (err) {
      console.warn('[permissions] no se pudieron sembrar los roles por defecto:', err)
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
  role: RoleDefinition,
): Promise<void> {
  // setDoc (no updateDoc) reemplaza el doc completo. Crítico porque updateDoc
  // ignora props con valor `undefined`: pasar de `allowedCompanyIds=[a,b]` a
  // "Acceso a todas" (undefined) NO borraría el array viejo del doc — el
  // filtro seguiría viendo el rol como restrictivo con los ids previos.
  // setDoc + roleToDoc garantiza estado limpio en cada guardado.
  await setDoc(roleDoc(companyId, roleId), roleToDoc(role))
}

export async function removeRole(companyId: string, roleId: string): Promise<void> {
  await deleteDoc(roleDoc(companyId, roleId))
}

// ---- Members ----

/** Seed membership solo para el owner. Cualquier otro usuario debe ser invitado
 *  explícitamente por el owner desde /settings/team — sin invitación no hay
 *  acceso a la company (necesario para que el filtro por empresa funcione).
 */
export async function seedMembershipIfNeeded(
  companyId: string,
  userId: string,
  email: string,
  displayName: string,
): Promise<CompanyMember | null> {
  const existing = await fetchMember(companyId, userId)
  if (existing) return existing

  // Solo el owner se autocrea como miembro. El resto necesita invitación.
  if (email.toLowerCase() !== OWNER_EMAIL) return null

  const member: Omit<CompanyMember, 'id'> = {
    userId,
    email,
    displayName: displayName || email,
    role: 'owner',
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

/** Cambia el cargo de un miembro. Va por callable porque las reglas ya no
 *  dejan escribir `companies/{id}/members/**` desde el navegador. */
export async function adminSetMemberRoleCallable(input: {
  companyId: string
  userId: string
  roleId: string
}): Promise<void> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<typeof input, { ok: boolean }>(functions, 'adminSetMemberRole')
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
