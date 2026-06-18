// Cron de costos fijos (recurrentes). Cada día genera las cuentas por pagar
// vencidas de cada regla recurrente activa, en TODAS las companies, sin depender
// de que alguien abra Ecore o App1. Replica la lógica de
// `src/modules/finance/recurring-generator.ts` (App1) /
// `src/modules/invoicing/recurring-generator.ts` (Ecore) con firebase-admin.
//
// Idempotente vía nextDueDate/lastGeneratedDate: avanza la fecha mientras
// nextDue <= hoy. Comparte la colección `recurring-transactions` con los
// generadores cliente, así que correr ambos NO duplica (cada ocurrencia avanza
// la regla; el que llegue después no encuentra nada vencido).

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { db, createDocumentInCollection, updateDocumentInCollection } from './firestore.js'

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurringRule {
  id: string
  concept?: string
  category?: string
  amount?: number
  type?: string
  status?: string
  notes?: string
  frequency?: Frequency
  endDate?: Timestamp
  nextDueDate?: Timestamp
  lastGeneratedDate?: Timestamp
  isActive?: boolean
  payeeRef?: unknown
  documentKind?: string
  priority?: string
  splitGroupId?: string
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addFrequency(date: Date, frequency: Frequency): Date {
  const next = new Date(date)
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
  }
  return next
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function generateForCompany(companyId: string): Promise<number> {
  const rulesSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('recurring-transactions')
    .where('isActive', '==', true)
    .get()

  const today = startOfDay(new Date())
  let generated = 0

  for (const doc of rulesSnap.docs) {
    const r = { id: doc.id, ...(doc.data() as Omit<RecurringRule, 'id'>) }
    if (!r.frequency) continue

    const endDate = r.endDate?.toDate?.()
    if (endDate && startOfDay(endDate) < today) continue

    let nextDue = r.nextDueDate?.toDate?.()
    if (!nextDue) continue

    let lastGenerated: Date | null = r.lastGeneratedDate?.toDate?.() ?? null
    let hasChanges = false

    while (startOfDay(nextDue) <= today) {
      if (endDate && startOfDay(nextDue) > startOfDay(endDate)) break

      // Admin SDK rechaza `undefined` → solo incluimos los opcionales presentes.
      const txData: Record<string, unknown> = {
        concept: r.concept ?? '',
        category: r.category ?? 'Sin categoría',
        amount: r.amount ?? 0,
        type: r.type ?? 'expense',
        date: Timestamp.fromDate(nextDue),
        status: r.status ?? 'pending',
        sourceType: 'recurring',
        sourceId: r.id,
        sourceLabel: `Recurrente — ${formatDateLabel(nextDue)}`,
      }
      if (r.notes != null) txData.notes = r.notes
      if (r.payeeRef != null) txData.payeeRef = r.payeeRef
      if (r.documentKind != null) txData.documentKind = r.documentKind
      if (r.priority != null) txData.priority = r.priority
      if (r.splitGroupId != null) txData.splitGroupId = `${r.splitGroupId}::${isoDate(nextDue)}`

      await createDocumentInCollection(companyId, 'transactions', txData)

      lastGenerated = nextDue
      nextDue = addFrequency(nextDue, r.frequency)
      hasChanges = true
      generated++
    }

    if (hasChanges) {
      const patch: Record<string, unknown> = { nextDueDate: Timestamp.fromDate(nextDue) }
      if (lastGenerated) patch.lastGeneratedDate = Timestamp.fromDate(lastGenerated)
      await updateDocumentInCollection(companyId, 'recurring-transactions', r.id, patch)
    }
  }

  return generated
}

export const dispatchRecurring = onSchedule(
  {
    schedule: 'every day 06:00',
    timeZone: 'America/Bogota',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 0,
  },
  async () => {
    const companies = await db.collection('companies').get()
    let totalGenerated = 0
    let failed = 0

    for (const company of companies.docs) {
      const companyId = company.id
      try {
        const count = await generateForCompany(companyId)
        if (count > 0) {
          totalGenerated += count
          console.log(`[recurring] ${companyId}: ${count} cuentas por pagar generadas`)
        }
      } catch (err) {
        failed++
        console.error(`[recurring] ${companyId} falló:`, err)
      }
    }

    console.log(`[recurring] total generadas=${totalGenerated} companies=${companies.size} fallidas=${failed}`)
  },
)
