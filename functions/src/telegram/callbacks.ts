// Router de callback_query por namespace. Extiende el bot de Telegram más allá
// del flujo legacy cf:/cx: (confirmar/cancelar mutaciones) sin tocarlo.
//
// Formato de callback_data: "ns:action[:arg[:arg2]]" (límite duro 64 bytes de
// Telegram). REGLA DE ORO: en callback_data sólo van ns:action + UN id de
// Firestore (~20 chars) y/o un entero/fecha corta. Nunca datos de negocio
// (montos, conceptos, listas) → eso va a telegramCallbackState.
//
// Integración (bot.ts, handler callback_query:data), tras answerCallbackQuery y
// ANTES del regex /^(cf|cx):/:
//     if (await router.dispatch(ctx, deps)) return
// Si el data empieza por cf/cx, ningún ns lo reclama y cae al código legacy.

import type { Context } from 'grammy'

type BotCtx = Context & { state: { uid: string } }

/** Lo que un handler de callback necesita del bot, inyectado por dispatch. */
export interface CallbackDeps {
  cfg: { token: string; geminiKey: string; groqKey: string; cerebrasKey: string }
  chatId: number
  uid: string
}

/** args = tokens después del namespace (data.split(':').slice(1)). */
export type CallbackHandler = (
  ctx: BotCtx,
  args: string[],
  deps: CallbackDeps,
) => Promise<void>

export interface CallbackRouter {
  register(namespace: string, handler: CallbackHandler): void
  /** true si algún namespace manejó el callback. */
  dispatch(ctx: BotCtx, deps: CallbackDeps): Promise<boolean>
}

export function createCallbackRouter(): CallbackRouter {
  const handlers = new Map<string, CallbackHandler>()

  return {
    register(namespace, handler) {
      handlers.set(namespace, handler)
    },
    async dispatch(ctx, deps) {
      const data = ctx.callbackQuery?.data
      if (!data) return false
      const parts = data.split(':')
      const ns = parts[0]
      const handler = handlers.get(ns)
      if (!handler) return false
      try {
        await handler(ctx, parts.slice(1), deps)
      } catch (err) {
        console.error(`[callbacks] handler "${ns}" falló:`, err)
        await ctx.reply('⚠️ Algo falló procesando el botón. Intenta de nuevo o escribe /menu.').catch(() => {})
      }
      return true
    },
  }
}
