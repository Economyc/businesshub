import { orderBy, doc, getDoc, setDoc, serverTimestamp, arrayUnion, updateDoc } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument, companyDoc } from '@/core/firebase/helpers'
import type { Conversation, UserAgentMemory, AgentThread, ThreadStatus } from './types'
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

// ─── Wave 4.2 — Threads (tareas de larga duración con estado persistente) ───
// Viven en `companies/{companyId}/threads/{threadId}`. Comparten el patrón
// del resto de subcolecciones de empresa: se filtran por company activa y
// las firestore rules permiten r/w a cualquier miembro autenticado.

const THREADS_COLLECTION = 'threads'

export const threadService = {
  list: (companyId: string) =>
    fetchCollection<AgentThread>(companyId, THREADS_COLLECTION, orderBy('updatedAt', 'desc')),

  get: (companyId: string, threadId: string) =>
    fetchDocument<AgentThread>(companyId, THREADS_COLLECTION, threadId),

  create: (
    companyId: string,
    partial: { title: string; context?: Record<string, unknown>; nextActions?: string[]; status?: ThreadStatus },
  ) =>
    createDocument(companyId, THREADS_COLLECTION, {
      title: partial.title,
      status: partial.status ?? 'in_progress',
      context: partial.context ?? {},
      conversationIds: [],
      nextActions: partial.nextActions ?? [],
    }),

  update: (companyId: string, threadId: string, patch: Partial<AgentThread>) =>
    updateDocument(companyId, THREADS_COLLECTION, threadId, patch as Record<string, unknown>),

  remove: (companyId: string, threadId: string) =>
    removeDocument(companyId, THREADS_COLLECTION, threadId),

  linkConversation: async (companyId: string, threadId: string, conversationId: string) => {
    if (!threadId || !conversationId) return
    // arrayUnion evita duplicados si el chat ya estaba vinculado.
    const ref = companyDoc(companyId, THREADS_COLLECTION, threadId)
    await updateDoc(ref, {
      conversationIds: arrayUnion(conversationId),
      updatedAt: serverTimestamp(),
    })
  },
}

// API funcional para que coincida con la firma del enunciado.
export const listThreads = (companyId: string) => threadService.list(companyId)
export const getThread = (companyId: string, threadId: string) => threadService.get(companyId, threadId)
export const createThread = (
  companyId: string,
  partial: { title: string; context?: Record<string, unknown>; nextActions?: string[]; status?: ThreadStatus },
) => threadService.create(companyId, partial)
export const updateThread = (companyId: string, threadId: string, patch: Partial<AgentThread>) =>
  threadService.update(companyId, threadId, patch)
export const deleteThread = (companyId: string, threadId: string) => threadService.remove(companyId, threadId)
export const linkConversationToThread = (companyId: string, threadId: string, conversationId: string) =>
  threadService.linkConversation(companyId, threadId, conversationId)
