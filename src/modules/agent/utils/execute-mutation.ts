import { Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getAppFunctions } from '@/core/firebase/config'
import { talentService } from '@/modules/talent/services'
import { supplierService } from '@/modules/suppliers/services'
import { financeService, budgetService } from '@/modules/finance/services'
import { payrollService } from '@/modules/payroll/services'
import { generatePendingTransactions } from '@/modules/finance/recurring-generator'
import { buildPayrollDraft } from '@/modules/agent/utils/payroll-helpers'
import { closingService } from '@/modules/closings/services'
import { influencerService } from '@/modules/marketing/influencers/services'
import { notificationService } from '@/modules/notifications/services'
import { templateService, contractService } from '@/modules/contracts/services'
import type { EmployeeFormData } from '@/modules/talent/types'
import type { SupplierFormData } from '@/modules/suppliers/types'
import type { TransactionFormData, PayeeRef, PayeeType } from '@/modules/finance/types'
import type { ClosingFormData } from '@/modules/closings/types'
import type { InfluencerVisitFormData, SocialNetwork, SocialPlatform } from '@/modules/marketing/influencers/types'
import type { NotificationFormData, NotificationType } from '@/modules/notifications/types'
import type { ContractFormData, ContractTemplate, ContractTemplateFormData } from '@/modules/contracts/types'
import type { ContractStatus, ContractType, Company } from '@/core/types'
import { resolvePayeeOnCompany, resolveCompany } from './resolve-payee'

function toTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr))
}

export interface MutationContext {
  companies: Company[]
}

export interface MutationResult {
  success: boolean
  message: string
  id?: string
  affectedCompanyIds?: string[]
}

export async function executeMutation(
  companyId: string,
  toolName: string,
  args: Record<string, unknown>,
  ctx?: MutationContext,
): Promise<MutationResult> {
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
      let targetCompanyId = companyId
      let targetCompanyLabel: string | null = null
      if (args.targetCompanyName && ctx?.companies) {
        const resolved = resolveCompany(String(args.targetCompanyName), ctx.companies)
        if (!resolved.ok) {
          if (resolved.reason === 'ambiguous') {
            return {
              success: false,
              message: `El local "${args.targetCompanyName}" es ambiguo. Coincide con: ${resolved.matches.map((c) => c.name).join(', ')}. Sé más específico.`,
            }
          }
          return { success: false, message: `No encontré el local "${args.targetCompanyName}".` }
        }
        targetCompanyId = resolved.company.id
        targetCompanyLabel = resolved.company.location ?? resolved.company.name
      }

      let payeeRef: PayeeRef | undefined
      if (args.payeeType && args.payeeName) {
        const resolution = await resolvePayeeOnCompany(
          targetCompanyId,
          args.payeeType as PayeeType,
          String(args.payeeName),
        )
        if (!resolution.ok) {
          if (resolution.reason === 'ambiguous') {
            return {
              success: false,
              message: `Hay varios "${args.payeeName}" registrados (${resolution.matches.map((m) => m.name).join(', ')}). Sé más específico o indica el ID.`,
            }
          }
          return {
            success: false,
            message: `No encontré "${args.payeeName}" en ${args.payeeType === 'partner' ? 'socios' : args.payeeType === 'employee' ? 'empleados' : 'proveedores'}. Crea el registro primero, o usa payeeType="external" para terceros sin perfil.`,
          }
        }
        payeeRef = resolution.payee
      }

      const data: TransactionFormData = {
        concept: String(args.concept),
        category: String(args.category),
        amount: Number(args.amount),
        type: args.type as 'income' | 'expense',
        date: toTimestamp(String(args.date)),
        status: (args.status as 'paid' | 'pending') ?? (payeeRef ? 'pending' : 'paid'),
        notes: args.notes ? String(args.notes) : undefined,
        ...(payeeRef ? { payeeRef } : {}),
      }
      const id = await financeService.create(targetCompanyId, data)
      const localSuffix = targetCompanyLabel ? ` en ${targetCompanyLabel}` : ''
      const payeeSuffix = payeeRef ? ` (debemos a ${payeeRef.name})` : ''
      return {
        success: true,
        message: `Transacción "${data.concept}" por $${data.amount.toLocaleString('es-CL')} creada${localSuffix}${payeeSuffix}.`,
        id,
        affectedCompanyIds: [targetCompanyId],
      }
    }

    case 'createSplitExpense': {
      if (!ctx?.companies) {
        return { success: false, message: 'No tengo el contexto de locales disponibles.' }
      }
      const splits = (args.splits as Array<{ companyName: string; amount?: number; percentage?: number }>) ?? []
      if (splits.length < 2) {
        return { success: false, message: 'Un gasto compartido necesita al menos 2 locales.' }
      }

      const totalAmount = Number(args.totalAmount)
      const splitMode = String(args.splitMode) as 'equal' | 'amounts' | 'percentages'

      const resolvedSplits: Array<{ company: Company; amount: number }> = []
      for (const s of splits) {
        const r = resolveCompany(s.companyName, ctx.companies)
        if (!r.ok) {
          if (r.reason === 'ambiguous') {
            return {
              success: false,
              message: `El local "${s.companyName}" es ambiguo (coincide con ${r.matches.map((c) => c.name).join(', ')}).`,
            }
          }
          return { success: false, message: `No encontré el local "${s.companyName}".` }
        }
        resolvedSplits.push({ company: r.company, amount: 0 })
      }

      if (splitMode === 'equal') {
        const each = Math.round(totalAmount / resolvedSplits.length)
        let assigned = 0
        resolvedSplits.forEach((rs, i) => {
          rs.amount = i === resolvedSplits.length - 1 ? totalAmount - assigned : each
          assigned += rs.amount
        })
      } else if (splitMode === 'amounts') {
        let sum = 0
        resolvedSplits.forEach((rs, i) => {
          const a = Number(splits[i].amount)
          if (!Number.isFinite(a) || a <= 0) {
            throw new Error(`Monto inválido para "${rs.company.name}".`)
          }
          rs.amount = a
          sum += a
        })
        if (Math.abs(sum - totalAmount) > 1) {
          return {
            success: false,
            message: `Los montos suman $${sum.toLocaleString('es-CL')} pero el total declarado es $${totalAmount.toLocaleString('es-CL')}. Ajusta los splits.`,
          }
        }
      } else {
        let sumPct = 0
        let assigned = 0
        resolvedSplits.forEach((rs, i) => {
          const p = Number(splits[i].percentage)
          if (!Number.isFinite(p) || p <= 0) {
            throw new Error(`Porcentaje inválido para "${rs.company.name}".`)
          }
          sumPct += p
          rs.amount = i === resolvedSplits.length - 1
            ? totalAmount - assigned
            : Math.round((totalAmount * p) / 100)
          assigned += rs.amount
        })
        if (Math.abs(sumPct - 100) > 0.5) {
          return { success: false, message: `Los porcentajes suman ${sumPct}% — deben sumar 100%.` }
        }
      }

      const payeeType = args.payeeType as PayeeType
      const payeeName = String(args.payeeName)
      // Resolvemos el payee contra la company activa (el id es el mismo en
      // todas las companies para suppliers/partners/employees compartidos? No,
      // las colecciones son por company. Asumimos que cada company tiene su
      // copia y resolvemos por company. Para 'external' es trivial.)
      const dateTs = toTimestamp(String(args.date))
      const splitGroupId = `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const notes = args.notes ? String(args.notes) : undefined
      const concept = String(args.concept)
      const category = String(args.category)
      const affectedIds: string[] = []

      for (const rs of resolvedSplits) {
        const resolution = await resolvePayeeOnCompany(rs.company.id, payeeType, payeeName)
        let payeeRef: PayeeRef
        if (resolution.ok) {
          payeeRef = resolution.payee
        } else if (payeeType === 'external') {
          payeeRef = { type: 'external', id: 'external', name: payeeName }
        } else {
          return {
            success: false,
            message: `No encontré "${payeeName}" en ${payeeType === 'partner' ? 'socios' : payeeType === 'employee' ? 'empleados' : 'proveedores'} de ${rs.company.name}. Crea el registro primero o usa payeeType="external".`,
          }
        }

        const data: TransactionFormData = {
          concept,
          category,
          amount: rs.amount,
          type: 'expense',
          date: dateTs,
          status: 'pending',
          notes,
          payeeRef,
          splitGroupId,
        }
        await financeService.create(rs.company.id, data)
        affectedIds.push(rs.company.id)
      }

      const summary = resolvedSplits
        .map((rs) => `${rs.company.location ?? rs.company.name} $${rs.amount.toLocaleString('es-CL')}`)
        .join(', ')
      return {
        success: true,
        message: `Gasto "${concept}" por $${totalAmount.toLocaleString('es-CL')} dividido entre ${resolvedSplits.length} locales (${summary}). Cada local le debe su parte a ${payeeName}.`,
        affectedCompanyIds: affectedIds,
      }
    }

    case 'updateTransaction': {
      const { id, ...changes } = args
      const updateData: Partial<TransactionFormData> = {}
      if (changes.concept) updateData.concept = String(changes.concept)
      if (changes.category) updateData.category = String(changes.category)
      if (changes.amount !== undefined) updateData.amount = Number(changes.amount)
      if (changes.type) updateData.type = changes.type as 'income' | 'expense'
      if (changes.date) updateData.date = toTimestamp(String(changes.date))
      if (changes.status) updateData.status = changes.status as 'paid' | 'pending'
      if (changes.notes !== undefined) updateData.notes = String(changes.notes)
      await financeService.update(companyId, String(id), updateData)
      return { success: true, message: 'Transacción actualizada exitosamente.' }
    }

    case 'deleteTransaction': {
      await financeService.remove(companyId, String(args.id))
      return { success: true, message: `Transacción "${args.concept}" eliminada.` }
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

    case 'deleteBudgetItem': {
      const budget = await budgetService.get(companyId)
      const category = String(args.category)
      const type = String(args.type) as 'income' | 'expense'
      const before = budget.items.length
      budget.items = budget.items.filter((i) => !(i.category === category && i.type === type))
      if (budget.items.length === before) {
        return { success: false, message: `No se encontró item "${category}" (${type}) en el presupuesto.` }
      }
      await budgetService.save(companyId, budget)
      return { success: true, message: `Item "${category}" eliminado del presupuesto.` }
    }

    case 'createPayrollDraft': {
      const year = Number(args.year)
      const month = Number(args.month)
      const data = await buildPayrollDraft(companyId, year, month)
      const id = await payrollService.create(companyId, data)
      return {
        success: true,
        message: `Borrador de nómina "${data.periodLabel}" creado con ${data.employeeCount} empleados. Neto a pagar: $${data.totalNetPay.toLocaleString('es-CL')}.`,
        id,
      }
    }

    case 'executeMonthClosing': {
      const generateRecurring = Boolean(args.generateRecurring)
      const periodLabel = String(args.periodLabel ?? '')
      let recurringGenerated = 0

      if (generateRecurring) {
        recurringGenerated = await generatePendingTransactions(companyId)
      }

      const parts: string[] = []
      if (recurringGenerated > 0) {
        parts.push(`${recurringGenerated} transacciones recurrentes generadas`)
      }
      parts.push(`Cierre de ${periodLabel} completado`)

      return {
        success: true,
        message: parts.join('. ') + '.',
      }
    }

    case 'createDailyClosing': {
      const ap = Number(args.ap) || 0
      const qr = Number(args.qr) || 0
      const datafono = Number(args.datafono) || 0
      const rappiVentas = Number(args.rappiVentas) || 0
      const efectivo = Number(args.efectivo) || 0
      const ventaTotal = ap + qr + datafono + rappiVentas + efectivo
      const data: ClosingFormData = {
        date: String(args.date),
        ap,
        qr,
        datafono,
        rappiVentas,
        efectivo,
        ventaTotal,
        propinas: Number(args.propinas) || 0,
        gastos: Number(args.gastos) || 0,
        cajaMenor: Number(args.cajaMenor) || 0,
        entregaEfectivo: Number(args.entregaEfectivo) || 0,
        responsable: String(args.responsable),
      }
      const id = await closingService.create(companyId, data)
      return {
        success: true,
        message: `Cierre del ${data.date} creado. Venta total: $${ventaTotal.toLocaleString('es-CL')}.`,
        id,
      }
    }

    case 'createInfluencerVisit': {
      const socialNetworks = (args.socialNetworks as Array<{ platform: string; handle: string }>) ?? []
      const content = (args.content as { story?: boolean; post?: boolean; reel?: boolean }) ?? {
        story: false,
        post: false,
        reel: false,
      }
      const data: InfluencerVisitFormData = {
        name: String(args.name),
        socialNetworks: socialNetworks.map(
          (s): SocialNetwork => ({ platform: s.platform as SocialPlatform, handle: s.handle }),
        ),
        visitDate: toTimestamp(String(args.visitDate)),
        content: {
          story: Boolean(content.story),
          post: Boolean(content.post),
          reel: Boolean(content.reel),
        },
        notes: args.notes ? String(args.notes) : undefined,
        status: (args.status as 'pending' | 'completed') ?? 'pending',
      }
      const id = await influencerService.create(companyId, data)
      return { success: true, message: `Visita de "${data.name}" registrada.`, id }
    }

    case 'markNotificationsRead': {
      const ids = (args.ids as string[]) ?? []
      await Promise.all(ids.map((id) => notificationService.markAsRead(companyId, id)))
      return { success: true, message: `${ids.length} notificación(es) marcadas como leídas.` }
    }

    case 'createNotification': {
      const data: NotificationFormData = {
        type: args.type as NotificationType,
        title: String(args.title),
        summary: String(args.summary),
        read: false,
      }
      const id = await notificationService.create(companyId, data)
      return { success: true, message: `Notificación "${data.title}" creada.`, id }
    }

    case 'createContractTemplate': {
      const data: ContractTemplateFormData = {
        name: String(args.name),
        contractType: args.contractType as ContractType,
        position: String(args.position),
        description: String(args.description),
        clauses: (args.clauses as ContractTemplateFormData['clauses']) ?? [],
        isDefault: Boolean(args.isDefault),
      }
      const id = await templateService.create(companyId, data)
      return { success: true, message: `Plantilla "${data.name}" creada con ${data.clauses.length} cláusulas.`, id }
    }

    case 'updateContractTemplate': {
      const { id, ...changes } = args
      const updateData: Partial<ContractTemplateFormData> = {}
      if (changes.name) updateData.name = String(changes.name)
      if (changes.position) updateData.position = String(changes.position)
      if (changes.description) updateData.description = String(changes.description)
      if (changes.isDefault !== undefined) updateData.isDefault = Boolean(changes.isDefault)
      await templateService.update(companyId, String(id), updateData)
      return { success: true, message: 'Plantilla actualizada.' }
    }

    case 'deleteContractTemplate': {
      await templateService.remove(companyId, String(args.id))
      return { success: true, message: `Plantilla "${args.name}" eliminada.` }
    }

    case 'createContractFromTemplate': {
      const template: ContractTemplate | null = await templateService.getById(companyId, String(args.templateId))
      if (!template) {
        return { success: false, message: `Plantilla ${args.templateId} no encontrada.` }
      }
      const endDate = args.endDate ? toTimestamp(String(args.endDate)) : undefined
      const data: ContractFormData = {
        templateId: template.id,
        templateName: template.name,
        contractType: template.contractType,
        employeeId: args.employeeId ? String(args.employeeId) : undefined,
        employeeName: String(args.employeeName),
        employeeIdentification: String(args.employeeIdentification),
        position: String(args.position),
        salary: Number(args.salary),
        startDate: toTimestamp(String(args.startDate)),
        endDate,
        status: 'draft' as ContractStatus,
        clauses: template.clauses.map((c) => ({
          id: c.id,
          title: c.title,
          content: c.content,
          isRequired: c.isRequired,
          order: c.order,
        })),
        metadata: {
          companyName: '',
          companyNit: '',
          companyAddress: '',
          companyLegalRep: '',
          employeeName: String(args.employeeName),
          employeeIdentification: String(args.employeeIdentification),
          employeeAddress: '',
          position: String(args.position),
          salary: Number(args.salary),
          salaryWords: '',
          paymentFrequency: 'Mensual',
          startDate: String(args.startDate),
          endDate: args.endDate ? String(args.endDate) : undefined,
          workSchedule: '',
          city: '',
        },
      }
      const id = await contractService.create(companyId, data)
      return {
        success: true,
        message: `Contrato para "${data.employeeName}" creado en estado borrador. Completa los datos faltantes desde Contratos.`,
        id,
      }
    }

    case 'triggerPosReconcile': {
      const days = Math.min(Number(args.days) || 7, 32)
      const functions = await getAppFunctions()
      const fn = httpsCallable<{ companyId: string; days: number }, { ventasWritten: number; daysWritten: number }>(
        functions,
        'posReconcileOnDemand',
      )
      const res = await fn({ companyId, days })
      const { ventasWritten, daysWritten } = res.data
      return {
        success: true,
        message: `Reconciliación POS completada: ${ventasWritten} ventas escritas en ${daysWritten} días (últimos ${days}).`,
      }
    }

    default:
      return { success: false, message: `Herramienta desconocida: ${toolName}` }
  }
}
