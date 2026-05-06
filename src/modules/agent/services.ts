import { orderBy, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { fetchCollection, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Conversation, UserAgentMemory } from './types'
import type { Message } from '@ai-sdk/ui-utils'

const COLLECTION = 'conversations'

export const conversationService = {
  getAll: (companyId: string) =>
    fetchCollection<Conversation>(companyId, COLLECTION, orderBy('updatedAt', 'desc')),

  create: (companyId: string, data: { title: string; messages: Message[]; messageCount: number }) =>
    createDocument(companyId, COLLECTION, data),

  update: (companyId: string, id: string, data: { messages: Message[]; messageCount: number; title?: string }) =>
    updateDocument(companyId, COLLECTION, id, data),

  remove: (companyId: string, id: string) =>
    removeDocument(companyId, COLLECTION, id),
}

// ─── Wave 1.2 — Memoria persistente del usuario ──────────────────────────
// Layer KV simple en `users/{uid}/agentMemory/preferences`. Un solo doc por
// usuario, scopeado por uid (no por compañía) — preferencias siguen al user
// entre tenants. Las firestore rules sólo permiten r/w al dueño.

export const DEFAULT_USER_AGENT_MEMORY: UserAgentMemory = {
  preferredCompanies: [],
  preferredFormat: 'auto',
  language: 'es',
  shortcuts: {},
  notes: '',
}

function userMemoryDocRef(uid: string) {
  return doc(db, 'users', uid, 'agentMemory', 'preferences')
}

export async function getUserMemory(uid: string): Promise<UserAgentMemory | null> {
  if (!uid) return null
  const snapshot = await getDoc(userMemoryDocRef(uid))
  if (!snapshot.exists()) return null
  const data = snapshot.data() as Partial<UserAgentMemory>
  // Merge contra defaults para tolerar docs antiguos sin alguno de los campos.
  return {
    ...DEFAULT_USER_AGENT_MEMORY,
    ...data,
    shortcuts: data.shortcuts ?? {},
    preferredCompanies: data.preferredCompanies ?? [],
  }
}

export async function updateUserMemory(uid: string, patch: Partial<UserAgentMemory>): Promise<void> {
  if (!uid) throw new Error('updateUserMemory: uid requerido')
  const ref = userMemoryDocRef(uid)
  // setDoc con merge:true crea el doc si no existe y respeta campos no tocados.
  await setDoc(
    ref,
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
