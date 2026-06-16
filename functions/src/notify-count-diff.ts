// Callable: envía al Telegram del usuario el reporte de diferencias de un conteo
// de inventario tras aprobarlo. El cliente manda la variance ya calculada (mensaje
// informativo; el stock real lo deriva el server de forma idempotente). Resuelve el
// chat por el uid del que aprueba (telegramLinks). No bloquea la aprobación: si no
// hay Telegram vinculado, devuelve { ok:false, reason:'not-linked' } sin lanzar.
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md), región us-central1.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firestore.js'
import { assertCompanyMember } from './utils/company-access.js'
import { telegramBotToken } from './telegram/index.js'

interface CountDiffLine {
  name: string
  unit: string
  expected: number
  counted: number
  diff: number
  diffValue: number | null
}

interface NotifyCountDiffData {
  companyId: string
  countDate: string
  approvedBy: string
  companyName?: string
  currency?: string
  lines: CountDiffLine[]
  totals: {
    shortageValue: number
    overageValue: number
    netValue: number
    itemsWithDiff: number
  }
}

const MAX_DETAIL_LINES = 50

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Formatea un monto COP con separador de miles colombiano: 1234567 → $1.234.567. */
function fmtMoney(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '-' : ''
  const grouped = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}$${grouped}`
}

/** Cantidad con hasta 1 decimal, sin ceros sobrantes. */
function fmtQty(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? r.toString() : r.toFixed(1)
}

function buildMessage(data: NotifyCountDiffData): string {
  const { totals } = data
  const title = data.companyName ? `Conteo de inventario — <b>${escapeHtml(data.companyName)}</b>` : 'Conteo de inventario'

  const header = [
    `📦 ${title}`,
    `Fecha: ${escapeHtml(data.countDate)} · Aprobado por: ${escapeHtml(data.approvedBy || '—')}`,
    '',
    `🔻 Faltante: <b>${fmtMoney(totals.shortageValue)}</b>`,
    `🔺 Sobrante: <b>${fmtMoney(totals.overageValue)}</b>`,
    `➖ Neto: <b>${fmtMoney(totals.netValue)}</b>`,
    `${totals.itemsWithDiff} ${totals.itemsWithDiff === 1 ? 'insumo' : 'insumos'} con diferencia`,
  ]

  const shown = data.lines.slice(0, MAX_DETAIL_LINES)
  const detail = shown.map((l) => {
    const sign = l.diff > 0 ? '+' : ''
    const tag = l.diff < 0 ? '🔻' : '🔺'
    const value = l.diffValue != null ? ` (${sign}${fmtMoney(l.diffValue)})` : ''
    return `${tag} ${escapeHtml(l.name)}: ${fmtQty(l.expected)} → ${fmtQty(l.counted)} ${escapeHtml(l.unit)} · ${sign}${fmtQty(l.diff)} ${escapeHtml(l.unit)}${value}`
  })
  if (data.lines.length > MAX_DETAIL_LINES) {
    detail.push(`…y ${data.lines.length - MAX_DETAIL_LINES} más`)
  }

  return [...header, '', '<b>Detalle</b>', ...detail].join('\n')
}

export const notifyCountDiff = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 30, secrets: [telegramBotToken] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    const data = request.data as NotifyCountDiffData
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'Falta companyId')

    await assertCompanyMember(request.auth.uid, data.companyId)

    // Chats de Telegram vinculados a este usuario (telegramLinks/{chatId}.uid).
    const snap = await db.collection('telegramLinks').where('uid', '==', request.auth.uid).get()
    if (snap.empty) return { ok: false, reason: 'not-linked' as const }

    const text = buildMessage(data)
    const token = telegramBotToken.value()

    let sent = 0
    for (const doc of snap.docs) {
      const chatId = doc.id
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
        })
        const json = (await res.json()) as { ok?: boolean }
        if (json.ok) sent += 1
      } catch {
        // Ignorar el chat que falle; intentar el resto.
      }
    }

    return { ok: sent > 0, sent }
  },
)
