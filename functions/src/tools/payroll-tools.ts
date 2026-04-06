import { tool } from 'ai'
import { z } from 'zod'
import { fetchCollection } from '../firestore.js'
import { calculatePayrollItemFromRaw, calculatePayrollTotals } from '../payroll-calculator.js'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function createPayrollTools(companyId: string) {
  return {
    generatePayrollPreview: tool({
      description:
        'Genera un preview de nómina para un mes específico. Calcula salario, auxilio de transporte, deducciones de salud y pensión para cada empleado activo. NO escribe datos — solo calcula y retorna el preview.',
      parameters: z.object({
        year: z.number().describe('Año de la nómina (ej: 2026)'),
        month: z.number().min(1).max(12).describe('Mes de la nómina (1-12)'),
      }),
      execute: async ({ year, month }) => {
        const [employees, payrolls] = await Promise.all([
          fetchCollection(companyId, 'employees'),
          fetchCollection(companyId, 'payrolls'),
        ])

        // Check if payroll already exists for this period
        const existing = payrolls.find(
          (p) => Number(p.year) === year && Number(p.month) === month
        )
        if (existing) {
          return {
            error: true,
            message: `Ya existe una nómina para ${MONTH_NAMES[month - 1]} ${year} con estado "${existing.status}".`,
            existingId: existing.id,
            existingStatus: existing.status,
          }
        }

        const activeEmployees = employees.filter((e) => e.status === 'active')
        if (activeEmployees.length === 0) {
          return {
            error: true,
            message: 'No hay empleados activos para generar la nómina.',
          }
        }

        // Calculate payroll for each active employee (base payroll, no overtime)
        const items = activeEmployees.map((emp) => calculatePayrollItemFromRaw(emp))
        const totals = calculatePayrollTotals(items)
        const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`

        return {
          error: false,
          year,
          month,
          periodLabel,
          employeeCount: items.length,
          items: items.map((item) => ({
            employeeId: item.employeeId,
            employeeName: item.employeeName,
            employeeRole: item.employeeRole,
            baseSalary: item.baseSalary,
            auxilioTransporte: item.auxilioTransporte,
            healthDeduction: item.healthDeduction,
            pensionDeduction: item.pensionDeduction,
            totalDeductions: item.totalDeductions,
            totalEarnings: item.totalEarnings,
            netPay: item.netPay,
          })),
          totals: {
            totalBaseSalary: totals.totalBaseSalary,
            totalAuxilio: totals.totalAuxilio,
            totalDeductions: totals.totalDeductions,
            totalEarnings: totals.totalEarnings,
            totalNetPay: totals.totalNetPay,
          },
        }
      },
    }),

    createPayrollDraft: tool({
      description:
        'Crea un borrador de nómina en el sistema. Requiere confirmación del usuario. Usa los datos previamente calculados por generatePayrollPreview.',
      parameters: z.object({
        year: z.number().describe('Año'),
        month: z.number().min(1).max(12).describe('Mes (1-12)'),
        periodLabel: z.string().describe('Etiqueta del periodo (ej: "Marzo 2026")'),
        employeeCount: z.number().describe('Cantidad de empleados'),
        totalNetPay: z.number().describe('Total neto a pagar'),
        totalEarnings: z.number().describe('Total devengado'),
        totalDeductions: z.number().describe('Total deducciones'),
      }),
      // No execute — handled client-side with confirmation
    }),
  }
}
