// Handlers del bot de Telegram. El bot es privado: todo update exige un
// link chatId↔uid en telegramLinks (creado vía /start TOKEN).
//
// Flujo de escritura: el LLM invoca una tool sin execute → guardamos la
// mutación pendiente + card con botones → callback ✅ ejecuta server-side
// (mutations.ts), inyecta el tool-result al historial y una segunda llamada
// LLM redacta el cierre. Solo una mutación pendiente por chat: un mensaje
// nuevo del usuario descarta la anterior (mantiene el historial sin
// tool-calls huérfanos, que Gemini rechaza).

import { Bot, Context, InlineKeyboard } from 'grammy'

/** Context flavor: el middleware de auth adjunta el uid vinculado. */
type BotContext = Context & { state: { uid: string } }
import type { CoreMessage } from 'ai'
import {
  resolveLink,
  consumeLinkToken,
  loadUserCompanies,
} from './auth.js'
import {
  loadHistory,
  saveHistory,
  clearHistory,
  loadChatState,
  updateChatState,
  type TelegramChatState,
} from './history.js'
import { runAgentTurn, AllProvidersBusyError, type AgentTurnResult } from './agent-runner.js'
import { createTelegramTools, FILE_TOOL_NAMES } from './tools.js'
import {
  savePendingMutation,
  setPendingMessageId,
  claimPendingMutation,
  finalizePendingMutation,
  buildConfirmationText,
} from './confirmations.js'
import { executeServerMutation, type MutationAttachment } from './mutations.js'
import { downloadTelegramFile, TelegramFileError } from './files.js'
import { resolveCompany, type CompanyInfo } from './resolve-payee.js'
import { toTelegramText, chunkText } from './format.js'
import { db } from '../firestore.js'
import type { UserAgentMemory } from '../system-prompt.js'

export interface BotConfig {
  token: string
  geminiKey: string
  groqKey: string
  cerebrasKey: string
}

const NOT_LINKED_MESSAGE =
  'Este bot es privado. Genera tu enlace de vinculación desde BusinessHub → Ajustes → Conectar Telegram.'

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

async function loadUserMemory(uid: string): Promise<UserAgentMemory | null> {
  try {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('agentMemory')
      .doc('preferences')
      .get()
    return snap.exists ? (snap.data() as UserAgentMemory) : null
  } catch {
    return null
  }
}

/** sendChatAction expira a los ~5s; lo repetimos mientras corre el LLM. */
function startTyping(ctx: Context): () => void {
  const send = () => ctx.api.sendChatAction(ctx.chat!.id, 'typing').catch(() => {})
  void send()
  const interval = setInterval(send, 4500)
  return () => clearInterval(interval)
}

async function sendAgentText(ctx: Context, text: string): Promise<void> {
  const plain = toTelegramText(text)
  if (!plain) return
  for (const chunk of chunkText(plain)) {
    await ctx.reply(chunk)
  }
}

function companyLabelFor(
  args: Record<string, unknown>,
  companies: CompanyInfo[],
  activeCompanyId: string,
): string {
  const name = args.targetCompanyName
  if (typeof name === 'string' && name.trim()) {
    const r = resolveCompany(name, companies)
    if (r.ok) return r.company.location ? `${r.company.name} (${r.company.location})` : r.company.name
    return name
  }
  const active = companies.find((c) => c.id === activeCompanyId)
  if (!active) return 'el local activo'
  return active.location ? `${active.name} (${active.location})` : active.name
}

/**
 * Si hay una mutación pendiente sin resolver, la descarta (el historial no
 * puede avanzar con un tool-call sin resultado). Devuelve el historial con el
 * tool-result de cancelación inyectado.
 */
async function discardStalePending(
  ctx: Context,
  chatId: number,
  state: TelegramChatState,
  history: CoreMessage[],
): Promise<CoreMessage[]> {
  const pendingId = state.pendingMutationId
  if (!pendingId) return history
  const claim = await claimPendingMutation(pendingId)
  await updateChatState(chatId, { pendingMutationId: null })
  if (!claim.ok) return history
  await finalizePendingMutation(pendingId, 'cancelled')
  if (claim.mutation.telegramMessageId) {
    await ctx.api
      .editMessageReplyMarkup(chatId, claim.mutation.telegramMessageId, { reply_markup: undefined })
      .catch(() => {})
  }
  return [
    ...history,
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: claim.mutation.toolCallId,
          toolName: claim.mutation.toolName,
          result: { success: false, message: 'El usuario no confirmó; la operación quedó descartada.' },
        },
      ],
    } as CoreMessage,
  ]
}

interface TurnContext {
  chatId: number
  uid: string
  companies: CompanyInfo[]
  activeCompanyId: string
  attachmentFileId: string | null
  attachmentMime: string | null
  attachmentName: string | null
}

/**
 * Entrega el resultado de un turno del agente: texto directo, o card de
 * confirmación si quedó una tool de escritura pendiente.
 */
async function deliverAgentResult(
  ctx: Context,
  turn: AgentTurnResult,
  history: CoreMessage[],
  tc: TurnContext,
): Promise<void> {
  let newHistory = [...history, ...turn.responseMessages]

  if (turn.pendingToolCalls.length === 0) {
    await saveHistory(tc.chatId, newHistory)
    await sendAgentText(ctx, turn.text || 'Listo.')
    return
  }

  // Una sola escritura por turno: la primera va a confirmación, las demás se
  // descartan con tool-result sintético (el prompt ya pide de a una).
  const [first, ...extras] = turn.pendingToolCalls
  for (const extra of extras) {
    newHistory = [
      ...newHistory,
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: extra.toolCallId,
            toolName: extra.toolName,
            result: {
              success: false,
              message: 'Descartada automáticamente: solo una operación de escritura por mensaje.',
            },
          },
        ],
      } as CoreMessage,
    ]
  }

  if (turn.text) await sendAgentText(ctx, turn.text)

  const needsFile = FILE_TOOL_NAMES.has(first.toolName)
  const pendingId = await savePendingMutation({
    chatId: tc.chatId,
    uid: tc.uid,
    companyId: tc.activeCompanyId,
    toolName: first.toolName,
    toolCallId: first.toolCallId,
    args: first.args,
    telegramFileId: needsFile ? tc.attachmentFileId : null,
    telegramFileMime: needsFile ? tc.attachmentMime : null,
    telegramFileName: needsFile ? tc.attachmentName : null,
  })

  const cardText = buildConfirmationText(
    first.toolName,
    first.args,
    companyLabelFor(first.args, tc.companies, tc.activeCompanyId),
    needsFile ? Boolean(tc.attachmentFileId) : true,
  )
  const keyboard = new InlineKeyboard()
    .text('✅ Confirmar', `cf:${pendingId}`)
    .text('❌ Cancelar', `cx:${pendingId}`)
  const sent = await ctx.reply(cardText, { reply_markup: keyboard })
  await setPendingMessageId(pendingId, sent.message_id)
  await updateChatState(tc.chatId, { pendingMutationId: pendingId })
  await saveHistory(tc.chatId, newHistory)
}

export function createTelegramBot(cfg: BotConfig): Bot<BotContext> {
  const bot = new Bot<BotContext>(cfg.token)

  // Solo chats privados.
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') return
    await next()
  })

  // ── /start [token] ───────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id
    const token = (ctx.match ?? '').trim()
    const existing = await resolveLink(chatId)

    if (existing && !token) {
      await ctx.reply('Ya estás vinculado ✅. Escríbeme lo que necesites — por ejemplo: "¿cuánto tengo vencido?" o mándame la foto de una factura.')
      return
    }
    if (!token) {
      await ctx.reply(NOT_LINKED_MESSAGE)
      return
    }
    const result = await consumeLinkToken(token, chatId, ctx.from?.username)
    if (!result.ok) {
      const reason =
        result.reason === 'expired'
          ? 'El enlace expiró (dura 15 minutos).'
          : result.reason === 'used'
            ? 'Ese enlace ya fue usado.'
            : 'Enlace inválido.'
      await ctx.reply(`${reason} Genera uno nuevo desde BusinessHub → Ajustes.`)
      return
    }
    const companies = await loadUserCompanies(result.uid)
    if (companies.length > 0) {
      await updateChatState(chatId, {
        uid: result.uid,
        activeCompanyId: companies[0].id,
        activeCompanyName: companies[0].name,
      })
    }
    const list = companies
      .map((c) => `- ${c.name}${c.location ? ` (${c.location})` : ''}`)
      .join('\n')
    await ctx.reply(
      `Cuenta vinculada ✅\n\nTus empresas:\n${list || '- (ninguna activa)'}\n\nLocal activo: ${companies[0]?.name ?? 'ninguno'}. Cámbialo con /empresa <nombre>.\n\nPrueba: "crea una cuenta por cobrar de 200 mil a Pepito en ${companies[0]?.name ?? 'tu local'}" o mándame la foto de una factura.`,
    )
  })

  // ── Resto: exige vinculación ─────────────────────────────────────────
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id
    if (!chatId) return
    const link = await resolveLink(chatId)
    if (!link) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery().catch(() => {})
      else await ctx.reply(NOT_LINKED_MESSAGE)
      return
    }
    ctx.state = { uid: link.uid }
    await next()
  })

  bot.command('reset', async (ctx) => {
    await clearHistory(ctx.chat.id)
    await updateChatState(ctx.chat.id, { pendingMutationId: null, latestAttachment: null })
    await ctx.reply('Memoria de la conversación borrada 🧹')
  })

  bot.command('empresa', async (ctx) => {
    const uid = ctx.state.uid
    const arg = (ctx.match ?? '').trim()
    const companies = await loadUserCompanies(uid)
    if (!arg) {
      const state = await loadChatState(ctx.chat.id)
      const list = companies
        .map((c) => `${c.id === state.activeCompanyId ? '▶️' : '·'} ${c.name}${c.location ? ` (${c.location})` : ''}`)
        .join('\n')
      await ctx.reply(`Tus empresas:\n${list}\n\nCambia con /empresa <nombre>.`)
      return
    }
    const resolved = resolveCompany(arg, companies)
    if (!resolved.ok) {
      await ctx.reply(
        resolved.reason === 'ambiguous'
          ? `"${arg}" es ambiguo: ${resolved.matches.map((c) => c.name).join(', ')}.`
          : `No encontré "${arg}".`,
      )
      return
    }
    await updateChatState(ctx.chat.id, {
      activeCompanyId: resolved.company.id,
      activeCompanyName: resolved.company.name,
    })
    await ctx.reply(`Local activo: ${resolved.company.name}${resolved.company.location ? ` (${resolved.company.location})` : ''} ✅`)
  })

  // ── Callbacks de confirmación ────────────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    // answerCallbackQuery YA, antes de ejecutar nada (Telegram exige <15s).
    await ctx.answerCallbackQuery().catch(() => {})
    const data = ctx.callbackQuery.data
    const match = /^(cf|cx):(.+)$/.exec(data)
    if (!match) return
    const [, action, pendingId] = match
    const chatId = ctx.chat!.id
    const uid = ctx.state.uid

    const claim = await claimPendingMutation(pendingId)
    if (!claim.ok) {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      await ctx.reply('⌛ Esa operación ya fue procesada o expiró.')
      return
    }
    const mutation = claim.mutation
    await updateChatState(chatId, { pendingMutationId: null })
    const history = await loadHistory(chatId)

    const appendToolResult = (result: Record<string, unknown>): CoreMessage[] => [
      ...history,
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: mutation.toolCallId,
            toolName: mutation.toolName,
            result,
          },
        ],
      } as CoreMessage,
    ]

    if (action === 'cx') {
      await finalizePendingMutation(pendingId, 'cancelled')
      const newHistory: CoreMessage[] = [
        ...appendToolResult({ success: false, message: 'El usuario canceló la operación.' }),
        { role: 'assistant', content: [{ type: 'text', text: 'Operación cancelada.' }] } as CoreMessage,
      ]
      await saveHistory(chatId, newHistory)
      await ctx.editMessageText(`${ctx.callbackQuery.message?.text ?? ''}\n\n❌ Cancelada`).catch(() => {})
      return
    }

    // ── Confirmar ──
    const stopTyping = startTyping(ctx)
    try {
      // Re-descarga el adjunto por file_id (nunca persistimos binarios).
      let attachment: MutationAttachment | null = null
      if (FILE_TOOL_NAMES.has(mutation.toolName) && mutation.telegramFileId) {
        try {
          attachment = await downloadTelegramFile(cfg.token, mutation.telegramFileId, {
            mimeType: mutation.telegramFileMime ?? 'image/jpeg',
            fileName: mutation.telegramFileName ?? undefined,
          })
        } catch (err) {
          if (err instanceof TelegramFileError) {
            await finalizePendingMutation(pendingId, 'cancelled')
            const newHistory: CoreMessage[] = [
              ...appendToolResult({ success: false, message: `No se pudo recuperar el archivo: ${err.message}` }),
              { role: 'assistant', content: [{ type: 'text', text: err.message }] } as CoreMessage,
            ]
            await saveHistory(chatId, newHistory)
            await ctx.editMessageText(`${ctx.callbackQuery.message?.text ?? ''}\n\n⚠️ Archivo no disponible`).catch(() => {})
            await ctx.reply(`⚠️ ${err.message}`)
            return
          }
          throw err
        }
      }

      const companies = await loadUserCompanies(uid)
      const result = await executeServerMutation({
        uid,
        defaultCompanyId: mutation.companyId,
        toolName: mutation.toolName,
        args: mutation.args,
        companies,
        attachment,
      })
      await finalizePendingMutation(pendingId, 'done', result.id)
      await ctx
        .editMessageText(
          `${ctx.callbackQuery.message?.text ?? ''}\n\n${result.success ? '✅ Confirmada' : '⚠️ Falló'}`,
        )
        .catch(() => {})

      const historyWithResult = appendToolResult(result as unknown as Record<string, unknown>)

      // Cierre del turno: el LLM redacta la respuesta final. La mutación YA
      // ocurrió — si el LLM falla, mandamos el mensaje crudo, jamás reintentamos.
      try {
        const state = await loadChatState(chatId)
        const activeCompanyId = state.activeCompanyId ?? mutation.companyId
        const userMemory = await loadUserMemory(uid)
        const tools = createTelegramTools({ activeCompanyId, companies, chatId })
        const turn = await runAgentTurn({
          messages: historyWithResult,
          companies,
          activeCompanyId,
          userMemory,
          tools,
          geminiKey: cfg.geminiKey,
          groqKey: cfg.groqKey,
          cerebrasKey: cfg.cerebrasKey,
          userId: uid,
          chatId,
        })
        await deliverAgentResult(ctx, turn, historyWithResult, {
          chatId,
          uid,
          companies,
          activeCompanyId,
          attachmentFileId: mutation.telegramFileId,
          attachmentMime: mutation.telegramFileMime,
          attachmentName: mutation.telegramFileName,
        })
      } catch {
        const fallbackHistory: CoreMessage[] = [
          ...historyWithResult,
          { role: 'assistant', content: [{ type: 'text', text: result.message }] } as CoreMessage,
        ]
        await saveHistory(chatId, fallbackHistory)
        await ctx.reply(`${result.success ? '✅' : '⚠️'} ${result.message}`)
      }
    } finally {
      stopTyping()
    }
  })

  // ── Mensajes (texto / foto / PDF) ────────────────────────────────────
  bot.on('message', async (ctx) => {
    const chatId = ctx.chat.id
    const uid = ctx.state.uid
    const msg = ctx.message

    if (msg.voice || msg.audio || msg.video || msg.video_note || msg.sticker) {
      await ctx.reply('Por ahora solo entiendo texto, fotos y PDFs 🙏')
      return
    }

    const text = (msg.text ?? msg.caption ?? '').trim()
    let fileId: string | null = null
    let fileMime: string | null = null
    let fileName: string | null = null

    if (msg.photo && msg.photo.length > 0) {
      fileId = msg.photo[msg.photo.length - 1].file_id
      fileMime = 'image/jpeg'
      fileName = 'factura.jpg'
    } else if (msg.document) {
      const mime = msg.document.mime_type ?? ''
      if (!ALLOWED_DOC_MIMES.has(mime)) {
        await ctx.reply('Solo acepto fotos (JPG/PNG/WebP) o PDFs.')
        return
      }
      fileId = msg.document.file_id
      fileMime = mime
      fileName = msg.document.file_name ?? (mime === 'application/pdf' ? 'documento.pdf' : 'imagen')
    }

    if (!text && !fileId) return

    const stopTyping = startTyping(ctx)
    try {
      const [companies, state, rawHistory, userMemory] = await Promise.all([
        loadUserCompanies(uid),
        loadChatState(chatId),
        loadHistory(chatId),
        loadUserMemory(uid),
      ])
      if (companies.length === 0) {
        await ctx.reply('Tu usuario no tiene empresas activas en BusinessHub.')
        return
      }

      const history = await discardStalePending(ctx, chatId, state, rawHistory)

      let activeCompanyId = state.activeCompanyId ?? ''
      if (!companies.some((c) => c.id === activeCompanyId)) {
        activeCompanyId = companies[0].id
        await updateChatState(chatId, {
          activeCompanyId,
          activeCompanyName: companies[0].name,
        })
      }

      // Contenido del mensaje del usuario (con adjunto como parte binaria
      // SOLO para este turno; al persistir se reemplaza por placeholder).
      const parts: Array<Record<string, unknown>> = []
      let needsPdfNative = false
      if (fileId && fileMime) {
        const downloaded = await downloadTelegramFile(cfg.token, fileId, {
          mimeType: fileMime,
          fileName: fileName ?? undefined,
        })
        if (fileMime === 'application/pdf') {
          needsPdfNative = true
          parts.push({ type: 'file', data: downloaded.buffer, mimeType: 'application/pdf' })
        } else {
          parts.push({ type: 'image', image: downloaded.buffer })
        }
        await updateChatState(chatId, {
          latestAttachment: { fileId, mimeType: fileMime, fileName: fileName ?? 'archivo' },
        })
      }
      if (text || parts.length === 0) {
        parts.unshift({ type: 'text', text: text || '(sin texto)' })
      }
      const userMessage = { role: 'user', content: parts } as unknown as CoreMessage
      const messages = [...history, userMessage]

      const tools = createTelegramTools({ activeCompanyId, companies, chatId })
      const turn = await runAgentTurn({
        messages,
        companies,
        activeCompanyId,
        userMemory,
        tools,
        geminiKey: cfg.geminiKey,
        groqKey: cfg.groqKey,
        cerebrasKey: cfg.cerebrasKey,
        userId: uid,
        chatId,
        needsPdfNative,
      })

      const effectiveAttachment = fileId
        ? { fileId, mime: fileMime, name: fileName }
        : state.latestAttachment
          ? {
              fileId: state.latestAttachment.fileId,
              mime: state.latestAttachment.mimeType,
              name: state.latestAttachment.fileName,
            }
          : null

      await deliverAgentResult(ctx, turn, messages, {
        chatId,
        uid,
        companies,
        activeCompanyId,
        attachmentFileId: effectiveAttachment?.fileId ?? null,
        attachmentMime: effectiveAttachment?.mime ?? null,
        attachmentName: effectiveAttachment?.name ?? null,
      })
    } catch (err) {
      if (err instanceof AllProvidersBusyError) {
        await ctx.reply('🤖 Los modelos de AI están saturados. Intenta de nuevo en un minuto.')
        return
      }
      if (err instanceof TelegramFileError) {
        await ctx.reply(`⚠️ ${err.message}`)
        return
      }
      console.error('[TelegramBot] message handler error:', err)
      const message = err instanceof Error ? err.message : 'Error desconocido'
      await ctx.reply(`⚠️ Algo falló procesando tu mensaje: ${message}`).catch(() => {})
    } finally {
      stopTyping()
    }
  })

  return bot
}
