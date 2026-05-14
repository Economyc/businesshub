import { Timestamp, writeBatch, doc } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import type { PayableFile, PayeeRef, RecurrenceFrequency, TransactionPriority } from './types'

export type SplitMode = 'equal' | 'amounts' | 'percentages'

export interface SplitEntryInput {
  companyId: string
  amount?: number
  percentage?: number
}

export interface SplitResult {
  companyId: string
  amount: number
}

// Reparte `totalAmount` entre las entradas según el modo. El remanente (de
// redondeo, o el desfase de ±1 al ingresar montos a mano) lo absorbe la
// última entrada, de modo que las partes siempre suman exacto. Lanza Error
// con mensaje legible si los datos no cuadran — el caller lo muestra al usuario.
export function computeSplits(
  totalAmount: number,
  mode: SplitMode,
  entries: SplitEntryInput[],
): SplitResult[] {
  if (entries.length < 2) throw new Error('Un gasto compartido necesita al menos 2 locales.')
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error('El monto total debe ser mayor a 0.')

  const out: SplitResult[] = entries.map((e) => ({ companyId: e.companyId, amount: 0 }))
  const last = out.length - 1

  if (mode === 'equal') {
    const each = Math.round(totalAmount / out.length)
    let assigned = 0
    out.forEach((r, i) => {
      r.amount = i === last ? totalAmount - assigned : each
      assigned += r.amount
    })
  } else if (mode === 'amounts') {
    let sum = 0
    out.forEach((r, i) => {
      const a = Number(entries[i].amount)
      if (!Number.isFinite(a) || a <= 0) throw new Error('Cada local debe tener un monto mayor a 0.')
      r.amount = a
      sum += a
    })
    if (Math.abs(sum - totalAmount) > 1) {
      throw new Error(
        `Los montos suman $${sum.toLocaleString('es-CO')} pero el total es $${totalAmount.toLocaleString('es-CO')}.`,
      )
    }
    // Desfase de ±1 (entrada flotante del agente): lo absorbe la última parte
    // para que el split persistido cierre exacto contra el total declarado.
    if (sum !== totalAmount) out[last].amount += totalAmount - sum
  } else {
    let sumPct = 0
    let assigned = 0
    out.forEach((r, i) => {
      const p = Number(entries[i].percentage)
      if (!Number.isFinite(p) || p <= 0) throw new Error('Cada local debe tener un porcentaje mayor a 0.')
      sumPct += p
      r.amount = i === last ? totalAmount - assigned : Math.round((totalAmount * p) / 100)
      assigned += r.amount
    })
    if (Math.abs(sumPct - 100) > 0.5) throw new Error(`Los porcentajes suman ${sumPct}% — deben sumar 100%.`)
  }

  return out
}

// Id de grupo para un split puntual. Mismo patrón que usa la herramienta del
// agente IA (`createSplitExpense`), para que ambas rutas — UI manual y
// asistente — produzcan ids con la misma forma.
export function makeSplitGroupId(): string {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Id de grupo para un reparto recurrente. La regla recurrente de cada local
// guarda este id; el generador deriva un splitGroupId por ocurrencia a partir
// de él (`${ruleGroupId}::${fechaISO}`).
export function makeRecurringSplitGroupId(): string {
  return `rsplit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface CreateSplitInvoicesArgs {
  entries: SplitResult[]
  concept: string
  category: string
  date: Timestamp
  priority: TransactionPriority
  notes?: string
  payeeRef?: PayeeRef
  splitGroupId: string
  docNumber?: string
  // Mapa companyId -> archivo subido al Drive de ese local. Si está presente
  // para un companyId, se persiste como sourceDocument en su factura hija.
  sourceDocuments?: Record<string, PayableFile>
}

// Crea, de forma atómica (writeBatch), una factura pendiente
// (documentKind='invoice') en cada local por su parte, todas con el mismo
// splitGroupId. Si cualquier escritura falla, no se persiste ninguna — así
// reintentar es seguro y no quedan splits parciales entre locales. Devuelve
// los companyId afectados para que el caller invalide sus caches.
export async function createSplitInvoices(args: CreateSplitInvoicesArgs): Promise<string[]> {
  const batch = writeBatch(db)
  const now = Timestamp.now()
  for (const entry of args.entries) {
    const ref = doc(companyCollection(entry.companyId, 'transactions'))
    const sourceDocument = args.sourceDocuments?.[entry.companyId]
    batch.set(ref, {
      concept: args.concept,
      category: args.category,
      amount: entry.amount,
      type: 'expense',
      date: args.date,
      status: 'pending',
      documentKind: 'invoice',
      priority: args.priority,
      splitGroupId: args.splitGroupId,
      ...(args.notes ? { notes: args.notes } : {}),
      ...(args.payeeRef ? { payeeRef: args.payeeRef } : {}),
      ...(args.docNumber ? { docNumber: args.docNumber } : {}),
      ...(sourceDocument ? { sourceDocument } : {}),
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()
  return args.entries.map((e) => e.companyId)
}

export interface CreateRecurringSplitRulesArgs {
  entries: SplitResult[]
  concept: string
  category: string
  frequency: RecurrenceFrequency
  startDate: Timestamp
  endDate?: Timestamp
  priority: TransactionPriority
  notes?: string
  payeeRef?: PayeeRef
  splitGroupId: string
}

// Crea, de forma atómica, una regla recurrente en cada local (su parte del
// reparto). Cada regla lleva documentKind='invoice' y el splitGroupId del
// grupo recurrente, que el generador propaga por ocurrencia. Devuelve los
// companyId afectados.
export async function createRecurringSplitRules(args: CreateRecurringSplitRulesArgs): Promise<string[]> {
  const batch = writeBatch(db)
  const now = Timestamp.now()
  for (const entry of args.entries) {
    const ref = doc(companyCollection(entry.companyId, 'recurring-transactions'))
    batch.set(ref, {
      concept: args.concept,
      category: args.category,
      amount: entry.amount,
      type: 'expense',
      status: 'pending',
      frequency: args.frequency,
      startDate: args.startDate,
      nextDueDate: args.startDate,
      isActive: true,
      documentKind: 'invoice',
      priority: args.priority,
      splitGroupId: args.splitGroupId,
      ...(args.endDate ? { endDate: args.endDate } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
      ...(args.payeeRef ? { payeeRef: args.payeeRef } : {}),
      createdAt: now,
      updatedAt: now,
    })
  }
  await batch.commit()
  return args.entries.map((e) => e.companyId)
}
