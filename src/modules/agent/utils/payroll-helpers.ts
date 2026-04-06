import { talentService } from '@/modules/talent/services'
import { calculatePayrollItem, calculatePayrollTotals } from '@/modules/payroll/calculator'
import type { PayrollFormData } from '@/modules/payroll/types'
import { MONTH_NAMES } from '@/modules/payroll/types'

/**
 * Builds a complete PayrollFormData by fetching active employees
 * and running the payroll calculator. Used by the agent mutation
 * to create a draft payroll from the server-side preview confirmation.
 */
export async function buildPayrollDraft(
  companyId: string,
  year: number,
  month: number,
): Promise<PayrollFormData> {
  const employees = await talentService.getAll(companyId)
  const active = employees.filter((e) => e.status === 'active')

  const items = active.map((emp) => calculatePayrollItem(emp))
  const totals = calculatePayrollTotals(items)

  return {
    year,
    month,
    periodLabel: `${MONTH_NAMES[month - 1]} ${year}`,
    status: 'draft',
    items,
    ...totals,
  }
}
