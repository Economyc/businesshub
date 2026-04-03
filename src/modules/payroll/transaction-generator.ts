import { writeBatch, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/core/firebase/config'
import { companyCollection } from '@/core/firebase/helpers'
import { invalidateCollection } from '@/core/query/invalidation'
import type { PayrollRecord } from './types'
import { MONTH_NAMES } from './types'

export async function syncPayrollTransaction(
  companyId: string,
  payrollId: string,
  payroll: PayrollRecord | Omit<PayrollRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const now = Timestamp.now()
  const monthLabel = MONTH_NAMES[payroll.month]
  const concept = `Nómina ${monthLabel} ${payroll.year}`
  const date = Timestamp.fromDate(new Date(payroll.year, payroll.month, 15))

  const ref = companyCollection(companyId, 'transactions')
  const batch = writeBatch(db)
  const newDoc = doc(ref)

  batch.set(newDoc, {
    concept,
    category: 'Nómina',
    amount: payroll.totalNetPay,
    type: 'expense',
    date,
    status: 'paid',
    sourceType: 'payroll',
    sourceId: payrollId,
    sourceLabel: concept,
    notes: `${payroll.employeeCount} empleados`,
    createdAt: now,
    updatedAt: now,
  })

  await batch.commit()
  invalidateCollection(companyId, 'transactions')
}
