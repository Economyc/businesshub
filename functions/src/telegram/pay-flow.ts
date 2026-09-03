// Flujo "pagar facturas pendientes" 100% por botones:
//   lista paginada → detalle → fecha de pago → tarjeta de confirmación cf:/cx:
// La confirmación reusa la tubería de mutaciones existente (quickMarkInvoiceAsPaid
// con origin:'ui', ejecutada server-side en mutations.ts).

import { randomUUID } from 'node:crypto'
import { InlineKeyboard } from 'grammy'
import type { Context } from 'grammy'
import type { CallbackRouter, CallbackDeps } from './callbacks.js'
import { createFinanceTools } from '../tools/finance-tools.js'
import { loadUserCompanies } from './auth.js'
import type { CompanyInfo } from './resolve-payee.js'
import { loadChatState, updateChatState } from './history.js'
import {
  saveCallbackState,
  loadCallbackState,
  patchCallbackState,
  type CallbackState,
} from './callback-state.js'
import { savePendingMutation, setPendingMessageId, buildConfirmationText } from './confirmations.js'
import {
  invoiceButtonLabel,
  backToMenuKeyboard,
  buildDatePicker,
  DATE_PICKER_TEXT,
  isoLabel,
} from './menus.js'
import { formatCop } from './format.js'

type BotCtx = Context & { state: { uid: string } }

const PAGE_SIZE = 8

interface PayInvoice {
  id: string
  concept: string
  /** Bruto de la factura (el gasto causado). */
  amount: number
  /** Lo que de verdad hay que girar = amount − retefuente. Es lo que se muestra. */
  payable: number
  withheld: number
  supplierName: string | null
  date: string | null
}

interface PayFlowPayload {
  invoices: PayInvoice[]
  selectedIdx?: number
}

function companyLabel(companies: CompanyInfo[], companyId: string): string {
  const c = companies.find((x) => x.id === companyId)
  if (!c) return 'el local'
  return c.location ? `${c.name} (${c.location})` : c.name
}

/** Resuelve la compañía objetivo del flujo: la pasada (validada) o la activa. */
async function resolveCompanyId(
  uid: string,
  chatId: number,
  companies: CompanyInfo[],
  requested?: string,
): Promise<string | null> {
  if (requested) {
    return companies.some((c) => c.id === requested) ? requested : null
  }
  const state = await loadChatState(chatId)
  const active = state.activeCompanyId
  if (active && companies.some((c) => c.id === active)) return active
  return companies[0]?.id ?? null
}

async function fetchPendingInvoices(companyId: string): Promise<PayInvoice[]> {
  const fin = createFinanceTools(companyId)
  const res = (await fin.getTransactions.execute!(
    {
      startDate: '2000-01-01',
      endDate: '2100-01-01',
      type: 'expense',
      status: 'pending',
      documentKind: 'invoice',
    } as never,
    undefined as never,
  )) as unknown as { transactions: Array<Record<string, unknown>> }
  return res.transactions
    .map((t) => ({
      id: String(t.id),
      concept: String(t.concept ?? ''),
      amount: Number(t.amount) || 0,
      // getTransactions ya devuelve el neto calculado (ver finance-tools).
      payable: Number(t.payableAmount ?? t.amount) || 0,
      withheld: Number(t.withholdingAmount) || 0,
      supplierName: (t.payeeName as string | null) ?? null,
      date: (t.date as string | null) ?? null,
    }))
    .sort((a, b) => b.payable - a.payable)
}

function buildListKeyboard(stateId: string, invoices: PayInvoice[], page: number): InlineKeyboard {
  const pages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE))
  const safePage = Math.min(Math.max(0, page), pages - 1)
  const slice = invoices.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const kb = new InlineKeyboard()
  slice.forEach((inv, i) => {
    const idx = safePage * PAGE_SIZE + i
    kb.text(invoiceButtonLabel(inv.supplierName, inv.payable), `pf:pick:${stateId}:${idx}`).row()
  })
  if (pages > 1) {
    if (safePage > 0) kb.text('‹', `pf:list:${stateId}:${safePage - 1}`)
    kb.text(`${safePage + 1}/${pages}`, 'dp:noop')
    if (safePage < pages - 1) kb.text('›', `pf:list:${stateId}:${safePage + 1}`)
    kb.row()
  }
  return backToMenuKeyboard(kb)
}

function listText(invoices: PayInvoice[]): string {
  const total = invoices.reduce((s, i) => s + i.payable, 0)
  return `💸 Facturas pendientes (${invoices.length}) — total ${formatCop(total)}\n\nElige una para marcarla pagada:`
}

/** Entrada del flujo: lista las facturas pendientes. Envía un mensaje nuevo. */
export async function openPayFlow(ctx: BotCtx, deps: CallbackDeps, requestedCompanyId?: string): Promise<void> {
  const { uid, chatId } = deps
  const companies = await loadUserCompanies(uid)
  const companyId = await resolveCompanyId(uid, chatId, companies, requestedCompanyId)
  if (!companyId) {
    await ctx.reply('Tu usuario no tiene empresas activas.')
    return
  }
  const invoices = await fetchPendingInvoices(companyId)
  if (invoices.length === 0) {
    await ctx.reply(`✅ No tienes facturas pendientes en ${companyLabel(companies, companyId)}.`)
    return
  }
  const stateId = await saveCallbackState({
    chatId,
    uid,
    companyId,
    kind: 'payFlow',
    payload: { invoices } satisfies PayFlowPayload,
  })
  await ctx.reply(listText(invoices), { reply_markup: buildListKeyboard(stateId, invoices, 0) })
}

async function loadPayState(
  ctx: BotCtx,
  stateId: string,
  chatId: number,
): Promise<CallbackState<PayFlowPayload> | null> {
  const state = await loadCallbackState<PayFlowPayload>(stateId, chatId)
  if (!state || state.kind !== 'payFlow') {
    await ctx.editMessageText('⌛ Este menú expiró. Escribe /menu para empezar de nuevo.').catch(() => {})
    return null
  }
  return state
}

/** Continuación tras elegir fecha en el selector: arma la tarjeta de confirmación. */
export async function continuePayFlowAfterDate(
  ctx: BotCtx,
  deps: CallbackDeps,
  state: CallbackState<PayFlowPayload>,
  dateIso: string,
): Promise<void> {
  const { uid, chatId } = deps
  const idx = state.payload.selectedIdx
  const inv = idx != null ? state.payload.invoices[idx] : undefined
  if (!inv) {
    await ctx.editMessageText('⚠️ No pude identificar la factura. Escribe /menu.').catch(() => {})
    return
  }
  const companies = await loadUserCompanies(uid)
  const args = {
    id: inv.id,
    concept: inv.concept,
    amount: inv.payable,
    supplierName: inv.supplierName ?? undefined,
    paidDate: dateIso,
  }
  const pendingId = await savePendingMutation({
    chatId,
    uid,
    companyId: state.companyId,
    toolName: 'quickMarkInvoiceAsPaid',
    toolCallId: `btn_${randomUUID()}`,
    origin: 'ui',
    args,
    telegramFileId: null,
    telegramFileMime: null,
    telegramFileName: null,
  })
  const card = buildConfirmationText('quickMarkInvoiceAsPaid', args, companyLabel(companies, state.companyId), true)
  const keyboard = new InlineKeyboard()
    .text('✅ Confirmar', `cf:${pendingId}`)
    .text('❌ Cancelar', `cx:${pendingId}`)
  const sent = await ctx.editMessageText(card, { reply_markup: keyboard }).catch(() => null)
  const messageId =
    sent && typeof sent === 'object' && 'message_id' in sent
      ? (sent as { message_id: number }).message_id
      : ctx.callbackQuery?.message?.message_id
  if (messageId) await setPendingMessageId(pendingId, messageId)
  await updateChatState(chatId, { pendingMutationId: pendingId })
  await patchCallbackState(state.stateId, { status: 'consumed' })
}

export function registerPayFlow(router: CallbackRouter): void {
  router.register('pf', async (ctx, args, deps) => {
    const action = args[0]
    const { chatId } = deps

    if (action === 'open') {
      await openPayFlow(ctx, deps, args[1])
      return
    }

    if (action === 'list') {
      const state = await loadPayState(ctx, args[1], chatId)
      if (!state) return
      const page = Number(args[2]) || 0
      await ctx
        .editMessageReplyMarkup({ reply_markup: buildListKeyboard(state.stateId, state.payload.invoices, page) })
        .catch(() => {})
      return
    }

    if (action === 'pick') {
      const state = await loadPayState(ctx, args[1], chatId)
      if (!state) return
      const idx = Number(args[2])
      const inv = state.payload.invoices[idx]
      if (!inv) {
        await ctx.editMessageText('⚠️ Factura no encontrada. Escribe /menu.').catch(() => {})
        return
      }
      const lines = [
        '🧾 Detalle de la factura',
        `Proveedor: ${inv.supplierName ?? 'Sin proveedor'}`,
        `Concepto: ${inv.concept}`,
        `Monto: ${formatCop(inv.payable)}`,
        // Con retefuente el monto girado no coincide con el de la factura:
        // decir por qué evita que parezca un error al cruzar contra el banco.
        ...(inv.withheld > 0
          ? [`Factura: ${formatCop(inv.amount)} · retefuente −${formatCop(inv.withheld)}`]
          : []),
        ...(inv.date ? [`Fecha: ${isoLabel(inv.date)}`] : []),
      ]
      const kb = new InlineKeyboard()
        .text('✅ Marcar pagada', `pf:date:${state.stateId}:${idx}`)
        .row()
        .text('⬅️ Volver', `pf:list:${state.stateId}:0`)
      await ctx.editMessageText(lines.join('\n'), { reply_markup: kb }).catch(() => {})
      return
    }

    if (action === 'date') {
      const state = await loadPayState(ctx, args[1], chatId)
      if (!state) return
      const idx = Number(args[2])
      await patchCallbackState(state.stateId, { payload: { ...state.payload, selectedIdx: idx } })
      await ctx.editMessageText(DATE_PICKER_TEXT, { reply_markup: buildDatePicker(state.stateId) }).catch(() => {})
      return
    }
  })
}
