// Registro rápido por botones: tipo (gasto/factura/pago) → proveedor → fecha →
// el usuario escribe monto y concepto. El último paso reusa el agente IA (parseo
// robusto de "50 mil") con los campos tipo/proveedor/fecha BLOQUEADOS vía
// extraSystemContext; el LLM emite createTransaction → tarjeta cf:/cx: normal.
//
// "Pagar factura" redirige al pay-flow (unifica). El paso de texto se maneja en
// bot.ts (bot.on('message')) leyendo el flag chatState.awaitingQuickEntry.

import { InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'
import type { CallbackRouter, CallbackDeps } from './callbacks.js'
import { createSupplierTools } from '../tools/supplier-tools.js'
import { loadUserCompanies } from './auth.js'
import { loadChatState, updateChatState } from './history.js'
import {
  saveCallbackState,
  loadCallbackState,
  patchCallbackState,
  type CallbackState,
} from './callback-state.js'
import { backToMenuKeyboard, buildDatePicker, DATE_PICKER_TEXT, clampLabel, isoLabel } from './menus.js'
import { openPayFlow } from './pay-flow.js'

type BotCtx = Context & { state: { uid: string } }

const SUP_PAGE_SIZE = 8

type EntryKind = 'expense' | 'invoice'

export interface QuickEntryPayload {
  kind: EntryKind
  suppliers: Array<{ id: string; name: string }>
  supplierName?: string | null
  date?: string
}

const CHOOSER_TEXT = '➕ ¿Qué quieres registrar?'

function chooserKeyboard(): InlineKeyboard {
  return backToMenuKeyboard(
    new InlineKeyboard()
      .text('💸 Gasto', 'qe:type:expense')
      .text('🧾 Factura (CxP)', 'qe:type:invoice')
      .row()
      .text('✅ Pagar factura', 'qe:type:pago'),
  )
}

/** Entrada del flujo (comando /registrar o botón ➕). Envía mensaje nuevo. */
export async function startQuickEntry(ctx: BotCtx, chatId: number): Promise<void> {
  await updateChatState(chatId, { awaitingQuickEntry: null })
  await ctx.reply(CHOOSER_TEXT, { reply_markup: chooserKeyboard() })
}

async function resolveActiveCompanyId(uid: string, chatId: number): Promise<string | null> {
  const [companies, state] = await Promise.all([loadUserCompanies(uid), loadChatState(chatId)])
  if (companies.length === 0) return null
  const active = state.activeCompanyId
  return active && companies.some((c) => c.id === active) ? active : companies[0].id
}

async function fetchActiveSuppliers(companyId: string): Promise<Array<{ id: string; name: string }>> {
  const sup = createSupplierTools(companyId)
  const res = (await sup.getSuppliers.execute!({ status: 'active' } as never, undefined as never)) as unknown as {
    suppliers: Array<{ id: unknown; name: unknown }>
  }
  return res.suppliers
    .map((s) => ({ id: String(s.id), name: String(s.name ?? '') }))
    .filter((s) => s.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function supplierKeyboard(
  stateId: string,
  suppliers: Array<{ id: string; name: string }>,
  page: number,
): InlineKeyboard {
  const pages = Math.max(1, Math.ceil(suppliers.length / SUP_PAGE_SIZE))
  const safePage = Math.min(Math.max(0, page), pages - 1)
  const slice = suppliers.slice(safePage * SUP_PAGE_SIZE, safePage * SUP_PAGE_SIZE + SUP_PAGE_SIZE)
  const kb = new InlineKeyboard()
  slice.forEach((s, i) => {
    const idx = safePage * SUP_PAGE_SIZE + i
    kb.text(clampLabel(s.name), `qe:sup:${stateId}:${idx}`).row()
  })
  if (pages > 1) {
    if (safePage > 0) kb.text('‹', `qe:slist:${stateId}:${safePage - 1}`)
    kb.text(`${safePage + 1}/${pages}`, 'dp:noop')
    if (safePage < pages - 1) kb.text('›', `qe:slist:${stateId}:${safePage + 1}`)
    kb.row()
  }
  kb.text('Sin proveedor / Otro', `qe:sup:${stateId}:none`).row()
  return backToMenuKeyboard(kb)
}

async function loadEntryState(
  ctx: BotCtx,
  stateId: string,
  chatId: number,
): Promise<CallbackState<QuickEntryPayload> | null> {
  const state = await loadCallbackState<QuickEntryPayload>(stateId, chatId)
  if (!state || state.kind !== 'quickEntry') {
    await ctx.editMessageText('⌛ Este menú expiró. Escribe /menu para empezar de nuevo.').catch(() => {})
    return null
  }
  return state
}

/** Instrucción para el LLM con los campos bloqueados del registro rápido. */
export function quickEntryInstructions(payload: QuickEntryPayload): string {
  const status = payload.kind === 'invoice' ? 'pending' : 'paid'
  const kindLabel =
    payload.kind === 'invoice' ? 'una FACTURA / cuenta por pagar (CxP) PENDIENTE' : 'un GASTO ya pagado'
  const payeeLine = payload.supplierName
    ? `- Proveedor: ${payload.supplierName} → usa payeeType="supplier", payeeName="${payload.supplierName}"`
    : '- Sin proveedor (omite payeeType/payeeName)'
  return [
    '## Registro rápido en curso (datos ya elegidos por botones — NO los cambies)',
    `El usuario está registrando ${kindLabel} con:`,
    '- type="expense"',
    `- status="${status}"`,
    `- date="${payload.date}"`,
    payeeLine,
    '',
    'Del mensaje del usuario extrae ÚNICAMENTE el monto (amount) y el concepto (concept), e infiere la',
    'categoría más adecuada del catálogo. Invoca createTransaction UNA sola vez con esos campos fijos más',
    'amount, concept y category. No hagas preguntas ni pidas confirmación por texto: emite la herramienta.',
  ].join('\n')
}

export async function loadQuickEntryState(
  stateId: string,
  chatId: number,
): Promise<CallbackState<QuickEntryPayload> | null> {
  const state = await loadCallbackState<QuickEntryPayload>(stateId, chatId)
  return state && state.kind === 'quickEntry' ? state : null
}

export function registerQuickEntry(router: CallbackRouter): void {
  router.register('qe', async (ctx, args, deps) => {
    const action = args[0]
    const { uid, chatId } = deps

    if (action === 'new') {
      await ctx.editMessageText(CHOOSER_TEXT, { reply_markup: chooserKeyboard() }).catch(() => {})
      return
    }

    if (action === 'type') {
      const kind = args[1] // 'expense' | 'invoice' | 'pago'
      if (kind === 'pago') {
        await openPayFlow(ctx, deps)
        return
      }
      if (kind !== 'expense' && kind !== 'invoice') return
      const companyId = await resolveActiveCompanyId(uid, chatId)
      if (!companyId) {
        await ctx.editMessageText('Tu usuario no tiene empresas activas.').catch(() => {})
        return
      }
      const suppliers = await fetchActiveSuppliers(companyId)
      const stateId = await saveCallbackState({
        chatId,
        uid,
        companyId,
        kind: 'quickEntry',
        payload: { kind, suppliers } satisfies QuickEntryPayload,
      })
      await ctx
        .editMessageText('🏷️ Elige el proveedor:', { reply_markup: supplierKeyboard(stateId, suppliers, 0) })
        .catch(() => {})
      return
    }

    if (action === 'slist') {
      const state = await loadEntryState(ctx, args[1], chatId)
      if (!state) return
      const page = Number(args[2]) || 0
      await ctx
        .editMessageReplyMarkup({ reply_markup: supplierKeyboard(state.stateId, state.payload.suppliers, page) })
        .catch(() => {})
      return
    }

    if (action === 'sup') {
      const state = await loadEntryState(ctx, args[1], chatId)
      if (!state) return
      const pick = args[2]
      let supplierName: string | null = null
      if (pick !== 'none') {
        supplierName = state.payload.suppliers[Number(pick)]?.name ?? null
      }
      await patchCallbackState(state.stateId, { payload: { ...state.payload, supplierName } })
      await ctx.editMessageText(DATE_PICKER_TEXT, { reply_markup: buildDatePicker(state.stateId) }).catch(() => {})
      return
    }
  })
}

/** Continuación tras elegir fecha: pide monto + concepto por texto. */
export async function continueQuickEntryAfterDate(
  ctx: BotCtx,
  deps: CallbackDeps,
  state: CallbackState<QuickEntryPayload>,
  dateIso: string,
): Promise<void> {
  const { chatId } = deps
  await patchCallbackState(state.stateId, { payload: { ...state.payload, date: dateIso } })
  await updateChatState(chatId, { awaitingQuickEntry: state.stateId })
  const supplier = state.payload.supplierName ? `\nProveedor: ${state.payload.supplierName}` : ''
  await ctx
    .editMessageText(
      `📝 Fecha: ${isoLabel(dateIso)}${supplier}\n\nAhora escríbeme el monto y el concepto.\nEj: "50 mil, gas" o "1.250.000 arriendo".`,
    )
    .catch(() => {})
}
