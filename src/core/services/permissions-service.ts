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
import type { CompanyMember } from '@/core/types/permissions'

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

/** Seed the current user as owner if no membership exists */
export async function seedMembershipIfNeeded(
  companyId: string,
  userId: string,
  email: string,
  displayName: string,
): Promise<CompanyMember | null> {
  const existing = await fetchMember(companyId, userId)
  if (existing) return existing

  // Only admin@filipoblue.co gets auto-seeded as owner
  const isAdmin = email === 'admin@filipoblue.co'
  if (!isAdmin) return null

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
