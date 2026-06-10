// Vinculación chat_id de Telegram ↔ uid de Firebase + carga de companies.
//
// Colecciones raíz (solo Admin SDK, sin reglas cliente):
//   telegramLinkTokens/{token}  — token de un solo uso generado desde la web
//   telegramLinks/{chatId}      — allowlist: única fuente de auth del bot

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { db } from '../firestore.js'
import type { CompanyInfo } from './resolve-payee.js'

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000

export interface TelegramLink {
  uid: string
  username?: string
}

export async function resolveLink(chatId: number): Promise<TelegramLink | null> {
  const snap = await db.collection('telegramLinks').doc(String(chatId)).get()
  if (!snap.exists) return null
  const data = snap.data() as { uid?: string; username?: string }
  if (!data?.uid) return null
  return { uid: data.uid, username: data.username }
}

/** Genera un token de un solo uso para el deep link t.me/<bot>?start=TOKEN. */
export async function createLinkToken(uid: string): Promise<string> {
  // Telegram solo acepta A-Za-z0-9_- en el payload de /start (máx 64 chars).
  const token = randomBytes(24).toString('base64url')
  await db.collection('telegramLinkTokens').doc(token).set({
    uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + LINK_TOKEN_TTL_MS),
    usedBy: null,
  })
  return token
}

export type ConsumeResult =
  | { ok: true; uid: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' }

export async function consumeLinkToken(
  token: string,
  chatId: number,
  username?: string,
): Promise<ConsumeResult> {
  const tokenRef = db.collection('telegramLinkTokens').doc(token)
  const linkRef = db.collection('telegramLinks').doc(String(chatId))

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef)
    if (!snap.exists) return { ok: false as const, reason: 'invalid' as const }
    const data = snap.data() as { uid: string; expiresAt?: Timestamp; usedBy?: number | null }
    if (data.usedBy != null) return { ok: false as const, reason: 'used' as const }
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      return { ok: false as const, reason: 'expired' as const }
    }
    tx.update(tokenRef, { usedBy: chatId, usedAt: FieldValue.serverTimestamp() })
    tx.set(linkRef, {
      uid: data.uid,
      username: username ?? null,
      linkedAt: FieldValue.serverTimestamp(),
    })
    return { ok: true as const, uid: data.uid }
  })
}

/**
 * Companies donde el uid es miembro activo. Mismo criterio que
 * utils/company-access.ts (members/{uid}.status === 'active').
 */
export async function loadUserCompanies(uid: string): Promise<CompanyInfo[]> {
  const snap = await db.collection('companies').get()
  const checks = await Promise.all(
    snap.docs.map(async (doc): Promise<CompanyInfo | null> => {
      const member = await doc.ref.collection('members').doc(uid).get()
      if (!member.exists) return null
      const status = (member.data() as { status?: string }).status
      if (status !== 'active') return null
      const data = doc.data() as { name?: string; location?: string; slug?: string }
      return {
        id: doc.id,
        name: data.name ?? doc.id,
        location: data.location ?? null,
        slug: data.slug ?? null,
      }
    }),
  )
  return checks.filter((c): c is CompanyInfo => c !== null)
}
