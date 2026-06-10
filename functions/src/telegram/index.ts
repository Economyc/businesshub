// Entry points del bot de Telegram:
//   telegramBot       — webhook HTTP (gen2). Seguridad en 3 capas:
//                       secret token del webhook + allowlist telegramLinks +
//                       assertCompanyMember en cada escritura.
//   telegramLinkStart — callable: genera el deep link t.me/<bot>?start=TOKEN
//                       para vincular la cuenta desde la web.
//
// Deploy SIEMPRE con gcloud (ver CLAUDE.md). maxInstances=1 + concurrency=1
// serializan los updates: sin carreras sobre el historial y costo acotado.

import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import type { Bot } from 'grammy'
import { timingSafeEqual } from 'node:crypto'
import {
  geminiApiKey,
  groqApiKey,
  cerebrasApiKey,
  langfusePublicKey,
  langfuseSecretKey,
  langfuseBaseUrl,
} from '../agent-chat.js'
import { driveClientId, driveClientSecret } from '../services/drive-oauth.js'
import { db } from '../firestore.js'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { createTelegramBot } from './bot.js'
import { createLinkToken } from './auth.js'

export const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
export const telegramWebhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET')

// Bot singleton por instancia warm. bot.init() hace getMe una vez.
let botPromise: Promise<Bot> | null = null

function getBot(): Promise<Bot> {
  if (!botPromise) {
    botPromise = (async () => {
      const bot = createTelegramBot({
        token: telegramBotToken.value(),
        geminiKey: geminiApiKey.value(),
        groqKey: groqApiKey.value(),
        cerebrasKey: cerebrasApiKey.value(),
      }) as unknown as Bot
      await bot.init()
      return bot
    })()
  }
  return botPromise
}

function secretTokenMatches(header: unknown): boolean {
  if (typeof header !== 'string' || !header) return false
  const expected = Buffer.from(telegramWebhookSecret.value())
  const received = Buffer.from(header)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

/** Dedupe por update_id: create() falla si ya existe → reintento de Telegram. */
async function isDuplicateUpdate(updateId: number): Promise<boolean> {
  try {
    await db
      .collection('telegramUpdates')
      .doc(String(updateId))
      .create({
        receivedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      })
    return false
  } catch (err) {
    const code = (err as { code?: number | string }).code
    if (code === 6 || code === 'already-exists' /* ALREADY_EXISTS */) return true
    throw err
  }
}

export const telegramBot = onRequest(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 1,
    concurrency: 1,
    secrets: [
      telegramBotToken,
      telegramWebhookSecret,
      geminiApiKey,
      groqApiKey,
      cerebrasApiKey,
      langfusePublicKey,
      langfuseSecretKey,
      langfuseBaseUrl,
      driveClientId,
      driveClientSecret,
    ],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }
    if (!secretTokenMatches(req.header('x-telegram-bot-api-secret-token'))) {
      res.status(401).send('Unauthorized')
      return
    }

    const update = req.body as { update_id?: number }
    if (typeof update?.update_id !== 'number') {
      res.status(400).send('Bad request')
      return
    }

    try {
      if (await isDuplicateUpdate(update.update_id)) {
        // Reintento de Telegram (el original sigue procesándose) → 200 y listo.
        res.status(200).json({ ok: true, duplicate: true })
        return
      }
      const bot = await getBot()
      await bot.handleUpdate(update as never)
      res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[telegramBot] update failed:', err)
      // 200 igualmente: el update ya quedó marcado en el dedupe y un retry de
      // Telegram no lo reprocesaría. El usuario ya recibió el error por chat.
      res.status(200).json({ ok: false })
    }
  },
)

// ─── Vinculación desde la web ─────────────────────────────────────────────

export const telegramLinkStart = onCall(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 15, secrets: [telegramBotToken] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login requerido')

    const token = await createLinkToken(request.auth.uid)

    // getMe para armar el deep link con el username real del bot.
    const meRes = await fetch(`https://api.telegram.org/bot${telegramBotToken.value()}/getMe`)
    const me = (await meRes.json()) as { ok: boolean; result?: { username?: string } }
    if (!me.ok || !me.result?.username) {
      throw new HttpsError('internal', 'No pude obtener el username del bot')
    }

    return {
      url: `https://t.me/${me.result.username}?start=${token}`,
      expiresInMinutes: 15,
    }
  },
)
