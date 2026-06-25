// Estado efímero de los flujos interactivos por botones (menús navegables).
//
// A diferencia de telegramPendingMutations (escritura transaccional, TTL 24h),
// esto es de lectura/navegación: la lista de facturas paginada o el borrador de
// un registro rápido, que no caben en los 64 bytes de callback_data de Telegram.
// El payload se serializa como JSON string (mismo motivo que en confirmations.ts
// e history.ts: Firestore rechaza ciertas estructuras anidadas).
//
// TTL corto (1h): si el usuario tappea un botón viejo, loadCallbackState devuelve
// null y el handler responde "menú expiró".

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../firestore.js'

const STATE_TTL_MS = 60 * 60 * 1000 // 1h

export type CallbackStateKind = 'payFlow' | 'quickEntry'

export interface CallbackState<P = unknown> {
  stateId: string
  chatId: number
  uid: string
  companyId: string
  kind: CallbackStateKind
  payload: P
  messageId?: number
  status: 'active' | 'consumed'
}

function stateRef(id: string) {
  return db.collection('telegramCallbackState').doc(id)
}

export async function saveCallbackState(data: {
  chatId: number
  uid: string
  companyId: string
  kind: CallbackStateKind
  payload: unknown
  messageId?: number
}): Promise<string> {
  const ref = db.collection('telegramCallbackState').doc()
  await ref.set({
    chatId: data.chatId,
    uid: data.uid,
    companyId: data.companyId,
    kind: data.kind,
    payload: JSON.stringify(data.payload),
    ...(data.messageId ? { messageId: data.messageId } : {}),
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + STATE_TTL_MS),
  })
  return ref.id
}

/**
 * Carga el estado si sigue vigente (no expirado) y pertenece a este chat.
 * Devuelve null si no existe, expiró o el chatId no coincide (defensa contra
 * callback_data de otro chat).
 */
export async function loadCallbackState<P = unknown>(
  stateId: string,
  chatId: number,
): Promise<CallbackState<P> | null> {
  const snap = await stateRef(stateId).get()
  if (!snap.exists) return null
  const raw = snap.data() as Record<string, unknown>
  if (Number(raw.chatId) !== chatId) return null
  if (raw.expiresAt && (raw.expiresAt as Timestamp).toMillis() < Date.now()) return null
  let payload: P
  try {
    payload = JSON.parse(String(raw.payload ?? 'null')) as P
  } catch {
    return null
  }
  return {
    stateId,
    chatId: Number(raw.chatId),
    uid: String(raw.uid),
    companyId: String(raw.companyId),
    kind: raw.kind as CallbackStateKind,
    payload,
    messageId: raw.messageId as number | undefined,
    status: (raw.status as 'active' | 'consumed') ?? 'active',
  }
}

export async function patchCallbackState(
  stateId: string,
  patch: { payload?: unknown; messageId?: number; status?: 'active' | 'consumed' },
): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() }
  if (patch.payload !== undefined) data.payload = JSON.stringify(patch.payload)
  if (patch.messageId !== undefined) data.messageId = patch.messageId
  if (patch.status !== undefined) data.status = patch.status
  await stateRef(stateId).set(data, { merge: true })
}
