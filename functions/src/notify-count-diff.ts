// Callable: envía al Telegram del usuario el reporte de diferencias de un conteo
// de inventario tras aprobarlo. El cliente manda la variance ya calculada (mensaje
// informativo; el stock real lo deriva el server de forma idempotente). Resuelve el
// chat por el uid del que aprueba (telegramLinks). No bloquea la aprobación: si no
// hay Telegram vinculado, devuelve { ok:false, reason:'not-linked' } sin lanzar.
//
// Si el cliente manda `allLines` (inventario completo), envía PDF + CSV adjuntos con
// un caption de resumen; si no, cae al mensaje de texto (retrocompatible).
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md), región us-central1.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { db } from './firestore.js'
import { assertCompanyMember } from './utils/company-access.js'
import { telegramBotToken } from './telegram/index.js'
import { fmtMoney, fmtQty } from './utils/format-money.js'
import { buildCountDiffPdf } from './utils/build-count-diff-pdf.js'
import { buildCountDiffCsv } from './utils/build-count-diff-csv.js'
import type { CountReportData } from './utils/count-report-types.js'

interface NotifyCountDiffData extends CountReportData {
  companyId: string
  currency?: string
}

const MAX_DETAIL_LINES = 50

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Cabecera + totales, sin detalle. Sirve de caption (límite 1024) y de base del mensaje. */
function buildHeader(data: NotifyCountDiffData): string[] {
  const { totals } = data
  const title = data.companyName
    ? `Conteo de inventario — <b>${escapeHtml(data.companyName)}</b>`
    : 'Conteo de inventario'
  return [
    `📦 ${title}`,
    `Fecha: ${escapeHtml(data.countDate)} · Aprobado por: ${escapeHtml(data.approvedBy || '—')}`,
    '',
    `🔻 Faltante: <b>${fmtMoney(totals.shortageValue)}</b>`,
    `🔺 Sobrante: <b>${fmtMoney(totals.overageValue)}</b>`,
    `➖ Neto: <b>${fmtMoney(totals.netValue)}</b>`,
    `${totals.itemsWithDiff} ${totals.itemsWithDiff === 1 ? 'insumo' : 'insumos'} con diferencia`,
  ]
}

/** Caption corto para los adjuntos (no incluye el detalle línea por línea). */
function buildCaption(data: NotifyCountDiffData): string {
  return [...buildHeader(data), '', 'Detalle completo en el PDF y el CSV adjuntos.'].join('\n')
}

/** Mensaje de texto con el detalle (fallback cuando no hay inventario completo). */
function buildMessage(data: NotifyCountDiffData): string {
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
  return [...buildHeader(data), '', '<b>Detalle</b>', ...detail].join('\n')
}

async function sendMessage(token: string, chatId: string, text: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  const json = (await res.json()) as { ok?: boolean }
  return !!json.ok
}

async function sendDocument(
  token: string,
  chatId: string,
  buffer: Buffer,
  filename: string,
  mime: string,
  caption?: string,
): Promise<boolean> {
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('document', new Blob([new Uint8Array(buffer)], { type: mime }), filename)
  if (caption) {
    form.append('caption', caption)
    form.append('parse_mode', 'HTML')
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form })
  const json = (await res.json()) as { ok?: boolean }
  return !!json.ok
}

export const notifyCountDiff = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 30, secrets: [telegramBotToken] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')
    const data = request.data as NotifyCountDiffData
    if (!data?.companyId) throw new HttpsError('invalid-argument', 'Falta companyId')

    await assertCompanyMember(request.auth.uid, data.companyId)

    // Chats de Telegram vinculados a este usuario (telegramLinks/{chatId}.uid).
    const snap = await db.collection('telegramLinks').where('uid', '==', request.auth.uid).get()
    if (snap.empty) return { ok: false, reason: 'not-linked' as const }

    const token = telegramBotToken.value()
    const withAttachments = !!data.allLines && data.allLines.length > 0

    // Genera los adjuntos una sola vez (reusa para todos los chats).
    let pdf: Buffer | null = null
    let csv: Buffer | null = null
    if (withAttachments) {
      try {
        pdf = await buildCountDiffPdf(data)
        csv = buildCountDiffCsv(data)
      } catch {
        // Si la generación falla, caemos al texto.
        pdf = null
        csv = null
      }
    }

    const safeDate = (data.countDate || 'conteo').replace(/[^\d-]/g, '')
    let sent = 0
    for (const doc of snap.docs) {
      const chatId = doc.id
      try {
        if (pdf && csv) {
          const okPdf = await sendDocument(token, chatId, pdf, `conteo-${safeDate}.pdf`, 'application/pdf', buildCaption(data))
          await sendDocument(token, chatId, csv, `conteo-${safeDate}.csv`, 'text/csv')
          if (okPdf) sent += 1
        } else {
          if (await sendMessage(token, chatId, buildMessage(data))) sent += 1
        }
      } catch {
        // Ignorar el chat que falle; intentar el resto.
      }
    }

    return { ok: sent > 0, sent }
  },
)
