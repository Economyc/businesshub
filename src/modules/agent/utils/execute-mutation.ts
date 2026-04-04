import { Timestamp } from 'firebase/firestore'
import { talentService } from '@/modules/talent/services'
import { supplierService } from '@/modules/suppliers/services'
import { financeService, budgetService } from '@/modules/finance/services'
import type { EmployeeFormData } from '@/modules/talent/types'
import type { SupplierFormData } from '@/modules/suppliers/types'
import type { TransactionFormData } from '@/modules/finance/types'

function toTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr))
}

export async function executeMutation(
  companyId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; message: string; id?: string }> {
  switch (toolName) {
    case 'createEmployee': {
      const data: EmployeeFormData = {
        name: String(args.name),
        identification: String(args.identification),
        role: String(args.role),
        department: String(args.department),
        email: String(args.email),
        phone: String(args.phone),
        salary: Number(args.salary),
        startDate: toTimestamp(String(args.startDate)),
        status: (args.status as 'active' | 'inactive') ?? 'active',
      }
      const id = await talentService.create(companyId, data)
      return { success: true, message: `Empleado "${data.name}" creado exitosamente.`, id }
    }

    case 'updateEmployee': {
      const { id, ...changes } = args
      const updateData: Partial<EmployeeFormData> = {}
      if (changes.name) updateData.name = String(changes.name)
      if (changes.role) updateData.role = String(changes.role)
      if (changes.department) updateData.department = String(changes.department)
      if (changes.email) updateData.email = String(changes.email)
      if (changes.phone) updateData.phone = String(changes.phone)
      if (changes.salary) updateData.salary = Number(changes.salary)
      if (changes.status) updateData.status = changes.status as 'active' | 'inactive'
      await talentService.update(companyId, String(id), updateData)
      return { success: true, message: 'Empleado actualizado exitosamente.' }
    }

    case 'deleteEmployee': {
      await talentService.remove(companyId, String(args.id))
      return { success: true, message: `Empleado "${args.name}" eliminado.` }
    }

    case 'createSupplier': {
      const data: SupplierFormData = {
        name: String(args.name),
        identification: String(args.identification),
        category: String(args.category),
        contactName: String(args.contactName),
        email: String(args.email),
        phone: String(args.phone),
        contractStart: toTimestamp(String(args.contractStart)),
        contractEnd: toTimestamp(String(args.contractEnd)),
        status: (args.status as 'active' | 'expired' | 'pending') ?? 'active',
      }
      const id = await supplierService.create(companyId, data)
      return { success: true, message: `Proveedor "${data.name}" creado exitosamente.`, id }
    }

    case 'updateSupplier': {
      const { id, ...changes } = args
      const updateData: Partial<SupplierFormData> = {}
      if (changes.name) updateData.name = String(changes.name)
      if (changes.category) updateData.category = String(changes.category)
      if (changes.contactName) updateData.contactName = String(changes.contactName)
      if (changes.email) updateData.email = String(changes.email)
      if (changes.phone) updateData.phone = String(changes.phone)
      if (changes.status) updateData.status = changes.status as 'active' | 'expired' | 'pending'
      await supplierService.update(companyId, String(id), updateData)
      return { success: true, message: 'Proveedor actualizado exitosamente.' }
    }

    case 'deleteSupplier': {
      await supplierService.remove(companyId, String(args.id))
      return { success: true, message: `Proveedor "${args.name}" eliminado.` }
    }

    case 'createTransaction': {
      const data: TransactionFormData = {
        concept: String(args.concept),
        category: String(args.category),
        amount: Number(args.amount),
        type: args.type as 'income' | 'expense',
        date: toTimestamp(String(args.date)),
        status: (args.status as 'paid' | 'pending') ?? 'paid',
        notes: args.notes ? String(args.notes) : undefined,
      }
      const id = await financeService.create(companyId, data)
      return { success: true, message: `Transacción "${data.concept}" por $${data.amount.toLocaleString('es-CL')} creada.`, id }
    }

    case 'updateBudget': {
      const budget = await budgetService.get(companyId)
      const category = String(args.category)
      const type = String(args.type) as 'income' | 'expense'
      const amount = Number(args.amount)
      const idx = budget.items.findIndex((i) => i.category === category && i.type === type)
      if (idx >= 0) {
        budget.items[idx].amount = amount
      } else {
        budget.items.push({ category, type, amount })
      }
      await budgetService.save(companyId, budget)
      return { success: true, message: `Presupuesto de "${category}" actualizado a $${amount.toLocaleString('es-CL')}.` }
    }

    case 'addBudgetItem': {
      const budget = await budgetService.get(companyId)
      const category = String(args.category)
      const type = String(args.type) as 'income' | 'expense'
      const amount = Number(args.amount)
      budget.items.push({ category, type, amount })
      await budgetService.save(companyId, budget)
      return { success: true, message: `Item "${category}" agregado al presupuesto por $${amount.toLocaleString('es-CL')}.` }
    }

    default:
      return { success: false, message: `Herramienta desconocida: ${toolName}` }
  }
}
