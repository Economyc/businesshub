import { Timestamp } from 'firebase/firestore'
import { recurringService } from './recurring-service'
import { financeService } from './services'
import { cacheDel } from '@/core/utils/cache'
import type { RecurringTransaction, RecurrenceFrequency } from './types'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addFrequency(date: Date, frequency: RecurrenceFrequency): Date {
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

export async function generatePendingTransactions(companyId: string): Promise<number> {
  const allRecurring = await recurringService.getAll(companyId)
  const active = allRecurring.filter((r) => r.isActive)
  const today = startOfDay(new Date())
  let generated = 0

  for (const recurring of active) {
    const endDate = recurring.endDate?.toDate?.()
    if (endDate && startOfDay(endDate) < today) continue

    let nextDue = recurring.nextDueDate?.toDate?.()
    if (!nextDue) continue

    let lastGenerated = recurring.lastGeneratedDate?.toDate?.() ?? null
    let hasChanges = false

    while (startOfDay(nextDue) <= today) {
      if (endDate && startOfDay(nextDue) > startOfDay(endDate)) break

      await financeService.create(companyId, {
        concept: recurring.concept,
        category: recurring.category,
        amount: recurring.amount,
        type: recurring.type,
        date: Timestamp.fromDate(nextDue),
        status: recurring.status,
        notes: recurring.notes,
        sourceType: 'recurring',
        sourceId: recurring.id,
        sourceLabel: `Recurrente — ${formatDateLabel(nextDue)}`,
      } as any)

      lastGenerated = nextDue
      nextDue = addFrequency(nextDue, recurring.frequency)
      hasChanges = true
      generated++
    }

    if (hasChanges) {
      await recurringService.update(companyId, recurring.id, {
        nextDueDate: Timestamp.fromDate(nextDue),
        lastGeneratedDate: lastGenerated ? Timestamp.fromDate(lastGenerated) : undefined,
      } as Partial<RecurringTransaction>)
    }
  }

  if (generated > 0) {
    cacheDel(`col:${companyId}:transactions`)
    cacheDel(`col:${companyId}:recurring-transactions`)
  }

  return generated
}
