// Confirmaciones de escritura: equivalente Telegram del ConfirmationCard web.
// La mutación pendiente vive en telegramPendingMutations/{id}; los botones
// llevan callback_data "cf:<id>" / "cx:<id>" (límite 64 bytes de Telegram).
// La transición pending → executing es transaccional: es la barrera contra
// doble tap y callbacks reenviados.

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { db } from '../firestore.js'
import { formatCop } from './format.js'

const PENDING_TTL_MS = 24 * 60 * 60 * 1000

export type PendingStatus = 'pending' | 'executing' | 'done' | 'cancelled' | 'expired'

export interface PendingMutation {
  chatId: number
  uid: string
  companyId: string
  toolName: string
  toolCallId: string
  args: Record<string, unknown>
  telegramFileId: string | null
  telegramFileMime: string | null
  telegramFileName: string | null
  status: PendingStatus
  telegramMessageId?: number
}

function pendingRef(id: string) {
  return db.collection('telegramPendingMutations').doc(id)
}

export async function savePendingMutation(
  data: Omit<PendingMutation, 'status'>,
): Promise<string> {
  const ref = db.collection('telegramPendingMutations').doc()
  await ref.set({
    ...data,
    // args como JSON string: pueden traer estructuras que Firestore rechaza.
    args: JSON.stringify(data.args),
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + PENDING_TTL_MS),
  })
  return ref.id
}

export async function setPendingMessageId(id: string, messageId: number): Promise<void> {
  await pendingRef(id).update({ telegramMessageId: messageId })
}

export type ClaimResult =
  | { ok: true; mutation: PendingMutation }
  | { ok: false; reason: 'not_found' | 'already_processed' }

/** Reclama la mutación (pending → executing) de forma transaccional. */
export async function claimPendingMutation(id: string): Promise<ClaimResult> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(pendingRef(id))
    if (!snap.exists) return { ok: false as const, reason: 'not_found' as const }
    const raw = snap.data() as Record<string, unknown>
    if (raw.status !== 'pending') {
      return { ok: false as const, reason: 'already_processed' as const }
    }
    if (raw.expiresAt && (raw.expiresAt as Timestamp).toMillis() < Date.now()) {
      tx.update(pendingRef(id), { status: 'expired' })
      return { ok: false as const, reason: 'already_processed' as const }
    }
    tx.update(pendingRef(id), { status: 'executing', claimedAt: FieldValue.serverTimestamp() })
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(String(raw.args ?? '{}'))
    } catch {
      /* args corruptos → mutación con args vacíos fallará con mensaje claro */
    }
    return {
      ok: true as const,
      mutation: {
        chatId: Number(raw.chatId),
        uid: String(raw.uid),
        companyId: String(raw.companyId),
        toolName: String(raw.toolName),
        toolCallId: String(raw.toolCallId),
        args,
        telegramFileId: (raw.telegramFileId as string | null) ?? null,
        telegramFileMime: (raw.telegramFileMime as string | null) ?? null,
        telegramFileName: (raw.telegramFileName as string | null) ?? null,
        status: 'executing',
        telegramMessageId: raw.telegramMessageId as number | undefined,
      },
    }
  })
}

export async function finalizePendingMutation(
  id: string,
  status: Extract<PendingStatus, 'done' | 'cancelled'>,
  resultId?: string,
): Promise<void> {
  await pendingRef(id).update({
    status,
    ...(resultId ? { resultId } : {}),
    finishedAt: FieldValue.serverTimestamp(),
  })
}

export async function markPendingCancelled(id: string): Promise<void> {
  await pendingRef(id).update({ status: 'cancelled', finishedAt: FieldValue.serverTimestamp() })
}

// ─── Texto del card de confirmación ──────────────────────────────────────

const str = (v: unknown): string => (v == null ? '' : String(v))

export function buildConfirmationText(
  toolName: string,
  args: Record<string, unknown>,
  companyLabel: string,
  hasFile: boolean,
): string {
  switch (toolName) {
    case 'createTransaction': {
      const isIncome = args.type === 'income'
      const isPending = (args.status ?? 'paid') === 'pending'
      const kind = isIncome
        ? isPending
          ? '💰 Crear cuenta por cobrar'
          : '💰 Crear ingreso'
        : isPending
          ? '🧾 Crear cuenta por pagar'
          : '🧾 Crear gasto'
      const lines = [
        `${kind} en ${companyLabel}`,
        `Concepto: ${str(args.concept)}`,
        `Monto: ${formatCop(Number(args.amount))}`,
        `Categoría: ${str(args.category)} — Fecha: ${str(args.date)}`,
      ]
      if (args.payeeName) {
        lines.push(`${isIncome ? 'Nos debe' : 'Le debemos a'}: ${str(args.payeeName)}`)
      }
      lines.push(`Estado: ${isPending ? 'Pendiente' : 'Pagada'}`)
      if (args.notes) lines.push(`Notas: ${str(args.notes)}`)
      return lines.join('\n')
    }
    case 'createPayableDocument': {
      const isInvoice = args.documentKind === 'invoice'
      const lines = [
        `${isInvoice ? '🧾 Crear factura (CxP)' : '🛒 Registrar compra al contado'} en ${companyLabel}`,
        `Proveedor: ${str(args.supplierName)}${args.customSupplier === true ? ' (ocasional)' : ''}`,
        `N°: ${str(args.docNumber)} — Fecha: ${str(args.date)}`,
        `Monto: ${formatCop(Number(args.amount))}`,
        `Categoría: ${str(args.category)}`,
      ]
      if (isInvoice && args.priority === 'immediate') lines.push('Prioridad: 🔴 URGENTE')
      if (args.notes) lines.push(`Notas: ${str(args.notes)}`)
      lines.push(hasFile ? 'Archivo: adjunto → se sube a Drive' : '⚠️ Sin archivo adjunto')
      return lines.join('\n')
    }
    case 'quickMarkInvoiceAsPaid': {
      const lines = [
        `✅ Marcar factura como pagada en ${companyLabel}`,
        `Factura: ${str(args.concept)}`,
        `Monto: ${formatCop(Number(args.amount))}`,
      ]
      if (args.supplierName) lines.push(`Proveedor: ${str(args.supplierName)}`)
      lines.push(`Fecha de pago: ${str(args.paidDate) || 'hoy'}`)
      lines.push('Sin comprobante adjunto')
      return lines.join('\n')
    }
    case 'markInvoiceAsPaid': {
      return [
        `✅ Cruzar pago de factura en ${companyLabel}`,
        `Proveedor: ${str(args.supplierName)}`,
        `Factura N°: ${str(args.docNumber)}`,
        `Monto: ${formatCop(Number(args.amount))}`,
        `Fecha de pago: ${str(args.paidDate)}`,
        hasFile ? 'Comprobante: adjunto → se archiva en Drive' : '⚠️ Sin comprobante adjunto',
      ].join('\n')
    }
    default:
      return `⚙️ ${toolName} en ${companyLabel}\n${JSON.stringify(args, null, 2).slice(0, 800)}`
  }
}
