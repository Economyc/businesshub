import { Timestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getAppFunctions } from '@/core/firebase/config'
import { talentService } from '@/modules/talent/services'
import { supplierService } from '@/modules/suppliers/services'
import { financeService, budgetService } from '@/modules/finance/services'
import { generatePendingTransactions } from '@/modules/finance/recurring-generator'
import { closingService } from '@/modules/closings/services'
import { influencerService } from '@/modules/marketing/influencers/services'
import { notificationService } from '@/modules/notifications/services'
import { templateService, contractService } from '@/modules/contracts/services'
import type { EmployeeFormData } from '@/modules/talent/types'
import type { SupplierFormData } from '@/modules/suppliers/types'
import type {
  TransactionFormData,
  PayeeRef,
  PayeeType,
  PayableFile,
  DocumentKind,
  TransactionPriority,
} from '@/modules/finance/types'
import type { ClosingFormData } from '@/modules/closings/types'
import type { InfluencerVisitFormData, SocialNetwork, SocialPlatform } from '@/modules/marketing/influencers/types'
import type { NotificationFormData, NotificationType } from '@/modules/notifications/types'
import type { ContractFormData, ContractTemplate, ContractTemplateFormData } from '@/modules/contracts/types'
import type { ContractStatus, ContractType, Company } from '@/core/types'
import { resolvePayeeOnCompany, resolveCompany } from './resolve-payee'
import { reportProgressClient } from './tool-progress-client'
import { computeSplits, makeSplitGroupId } from '@/modules/finance/split-service'

function toTimestamp(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr))
}

export interface MutationContext {
  companies: Company[]
  /**
   * Adjunto más reciente del usuario, si lo hay. Se usa por tools que
   * persisten archivos a Drive (createPayableDocument, markInvoiceAsPaid).
   * `dataUrl` es un data URL base64 (e.g. "data:image/jpeg;base64,...").
   */
  latestAttachment?: {
    name: string
    contentType: string
    dataUrl: string
  } | null
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
  toolCallId?: string,
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

      try {
        const computed = computeSplits(
          totalAmount,
          splitMode,
          resolvedSplits.map((rs, i) => ({
            companyId: rs.company.id,
            amount: splits[i].amount,
            percentage: splits[i].percentage,
          })),
        )
        computed.forEach((c, i) => { resolvedSplits[i].amount = c.amount })
      } catch (err) {
        return { success: false, message: (err as Error).message }
      }

      const payeeType = args.payeeType as PayeeType
      const payeeName = String(args.payeeName)
      // Resolvemos el payee: `suppliers` es colección raíz compartida entre
      // todas las companies (mismo id en cualquier company); `partners` y
      // `employees` siguen siendo por company. Para 'external' es trivial.
      const dateTs = toTimestamp(String(args.date))
      const splitGroupId = makeSplitGroupId()
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
      if (changes.priority) updateData.priority = changes.priority as TransactionPriority
      if (changes.documentKind) updateData.documentKind = changes.documentKind as DocumentKind
      if (changes.paidDate) updateData.paidDate = toTimestamp(String(changes.paidDate))
      await financeService.update(companyId, String(id), updateData)
      return { success: true, message: 'Transacción actualizada exitosamente.' }
    }

    case 'deleteTransaction': {
      await financeService.remove(companyId, String(args.id))
      return { success: true, message: `Transacción "${args.concept}" eliminada.` }
    }

    case 'quickMarkInvoiceAsPaid': {
      const id = String(args.id)
      const existing = await financeService.getById(companyId, id)
      if (!existing) return { success: false, message: 'No encontré esa factura.' }
      if (existing.status !== 'pending') {
        return { success: false, message: 'Esa factura no está pendiente — ya está pagada o cancelada.' }
      }
      const paidDateStr = args.paidDate
        ? String(args.paidDate)
        : new Date().toISOString().slice(0, 10)
      await financeService.update(companyId, id, {
        status: 'paid',
        paidDate: toTimestamp(paidDateStr),
      } as Partial<TransactionFormData>)
      const supplier = args.supplierName ? ` de ${String(args.supplierName)}` : ''
      const amountLabel =
        args.amount !== undefined ? ` por $${Number(args.amount).toLocaleString('es-CO')}` : ''
      return {
        success: true,
        message: `Factura "${String(args.concept)}"${supplier}${amountLabel} marcada como Pagada.`,
        id,
      }
    }

    case 'bulkMarkAsPaid': {
      const items =
        (args.items as Array<{ id: string; concept?: string; amount?: number }>) ?? []
      if (items.length === 0) {
        return { success: false, message: 'No se recibieron facturas a marcar como pagadas.' }
      }
      const paidDateStr = args.paidDate
        ? String(args.paidDate)
        : new Date().toISOString().slice(0, 10)
      const paidTs = toTimestamp(paidDateStr)

      const results = await Promise.allSettled(
        items.map((it) =>
          financeService.update(companyId, String(it.id), {
            status: 'paid',
            paidDate: paidTs,
          } as Partial<TransactionFormData>),
        ),
      )

      const failed = results
        .map((r, i) => ({ r, item: items[i] }))
        .filter((x) => x.r.status === 'rejected')

      const successCount = results.length - failed.length
      const failSummary = failed.length
        ? ` (${failed.length} fallaron: ${failed.map((f) => f.item.concept ?? f.item.id).join(', ')})`
        : ''
      return {
        success: successCount > 0,
        message: `${successCount} de ${items.length} facturas marcadas como Pagadas${failSummary}.`,
      }
    }

    case 'bulkSetPriority': {
      const items = (args.items as Array<{ id: string; concept?: string }>) ?? []
      const priority = args.priority as TransactionPriority
      if (items.length === 0) {
        return { success: false, message: 'No se recibieron transacciones a actualizar.' }
      }
      if (priority !== 'immediate' && priority !== 'waiting') {
        return { success: false, message: 'Prioridad inválida — debe ser "immediate" o "waiting".' }
      }

      const results = await Promise.allSettled(
        items.map((it) =>
          financeService.update(companyId, String(it.id), {
            priority,
          } as Partial<TransactionFormData>),
        ),
      )

      const failed = results
        .map((r, i) => ({ r, item: items[i] }))
        .filter((x) => x.r.status === 'rejected')

      const successCount = results.length - failed.length
      const priorityLabel = priority === 'immediate' ? 'urgente' : 'normal'
      const failSummary = failed.length
        ? ` (${failed.length} fallaron: ${failed.map((f) => f.item.concept ?? f.item.id).join(', ')})`
        : ''
      return {
        success: successCount > 0,
        message: `${successCount} de ${items.length} marcadas como ${priorityLabel}${failSummary}.`,
      }
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

    case 'executeMonthClosing': {
      const generateRecurring = Boolean(args.generateRecurring)
      const periodLabel = String(args.periodLabel ?? '')
      let recurringGenerated = 0

      // Wave 2.3 — progreso incremental escrito desde cliente.
      void reportProgressClient(toolCallId, { label: 'Validando datos', status: 'running' })
      void reportProgressClient(toolCallId, { label: 'Calculando totales', status: 'running' })

      if (generateRecurring) {
        void reportProgressClient(toolCallId, { label: 'Generando asientos', status: 'running' })
        recurringGenerated = await generatePendingTransactions(companyId)
      }

      void reportProgressClient(toolCallId, { label: 'Guardando cierre', status: 'done' })

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

      // Wave 2.3 — progreso incremental. El primer paso lo escribe el
      // cliente; pasos del lado servidor (consultando POS, actualizando
      // Firestore) los reporta el callable usando el mismo toolCallId.
      void reportProgressClient(toolCallId, { label: 'Obteniendo ventana', status: 'running' })

      const fn = httpsCallable<
        { companyId: string; days: number; toolCallId?: string },
        { ventasWritten: number; daysWritten: number }
      >(functions, 'posReconcileOnDemand')
      const res = await fn({ companyId, days, toolCallId })
      const { ventasWritten, daysWritten } = res.data

      void reportProgressClient(toolCallId, { label: 'Reconciliación finalizada', status: 'done' })

      return {
        success: true,
        message: `Reconciliación POS completada: ${ventasWritten} ventas escritas en ${daysWritten} días (últimos ${days}).`,
      }
    }

    case 'createPayableDocument': {
      // Sube el adjunto del último mensaje a Drive y crea Transaction.
      if (!ctx?.latestAttachment) {
        return {
          success: false,
          message: 'No encuentro el archivo adjunto. Sube de nuevo la factura o compra como adjunto en el mensaje.',
        }
      }
      const documentKind = args.documentKind as DocumentKind
      if (documentKind !== 'invoice' && documentKind !== 'purchase') {
        return { success: false, message: 'documentKind inválido — debe ser "invoice" o "purchase".' }
      }

      const supplierName = String(args.supplierName ?? '').trim()
      const docNumber = String(args.docNumber ?? '').trim()
      const dateStr = String(args.date ?? '').trim()
      const amount = Number(args.amount)
      const category = String(args.category ?? '').trim()
      if (!supplierName || !docNumber || !dateStr || !amount || !category) {
        return { success: false, message: 'Faltan campos requeridos (proveedor, número, fecha, monto, categoría).' }
      }

      // Resolución del proveedor:
      //  - customSupplier=true  → external (proveedor ocasional, no se registra).
      //  - customSupplier=false → busca en suppliers; si no existe, devuelve error
      //    pidiendo confirmación para usar custom o registrarlo primero.
      const useCustomSupplier = args.customSupplier === true
      let payeeRef: PayeeRef
      if (useCustomSupplier) {
        payeeRef = { type: 'external', id: 'external', name: supplierName }
      } else {
        const resolution = await resolvePayeeOnCompany(companyId, 'supplier', supplierName)
        if (!resolution.ok) {
          if (resolution.reason === 'ambiguous') {
            return {
              success: false,
              message: `Hay varios "${supplierName}" registrados. Sé más específico.`,
            }
          }
          return {
            success: false,
            message:
              `No encontré "${supplierName}" en proveedores. ` +
              `Si es un proveedor ocasional que no quieres registrar, vuelve a intentarlo pasando customSupplier=true. ` +
              `Si debería quedar registrado, crea primero el proveedor.`,
          }
        }
        payeeRef = resolution.payee
      }

      // Sube a Drive.
      const docType: 'Factura' | 'Compra' = documentKind === 'invoice' ? 'Factura' : 'Compra'
      const dataUrl = ctx.latestAttachment.dataUrl
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      const fns = await getAppFunctions()
      const uploadFn = httpsCallable<
        {
          companyId: string
          docType: 'Factura' | 'Pago' | 'Compra'
          supplierName: string
          docNumber: string
          date: string
          fileBase64: string
          fileName: string
          mimeType: string
        },
        { driveFileId: string; webViewLink: string; fileName: string }
      >(fns, 'uploadDocumentToDrive')

      void reportProgressClient(toolCallId, { label: 'Subiendo archivo a Drive', status: 'running' })
      const uploadRes = await uploadFn({
        companyId,
        docType,
        supplierName: payeeRef.name,
        docNumber,
        date: dateStr,
        fileBase64: base64,
        fileName: ctx.latestAttachment.name,
        mimeType: ctx.latestAttachment.contentType,
      })

      const dateTs = toTimestamp(dateStr)
      const sourceDocument: PayableFile = {
        driveFileId: uploadRes.data.driveFileId,
        driveWebViewLink: uploadRes.data.webViewLink,
        fileName: uploadRes.data.fileName,
        mimeType: ctx.latestAttachment.contentType,
        uploadedAt: Timestamp.now(),
      }

      const priorityArg =
        args.priority === 'immediate' || args.priority === 'waiting'
          ? (args.priority as TransactionPriority)
          : undefined
      const data: TransactionFormData = {
        concept: `${payeeRef.name} - ${docType} ${docNumber}`,
        category,
        amount,
        type: 'expense',
        date: dateTs,
        status: documentKind === 'invoice' ? 'pending' : 'paid',
        notes: args.notes ? String(args.notes) : undefined,
        payeeRef,
        documentKind,
        docNumber,
        sourceDocument,
        ...(documentKind === 'purchase' ? { paidDate: dateTs } : {}),
        ...(documentKind === 'invoice' && priorityArg ? { priority: priorityArg } : {}),
      }
      const id = await financeService.create(companyId, data)
      void reportProgressClient(toolCallId, { label: 'Guardado', status: 'done' })

      return {
        success: true,
        message:
          documentKind === 'invoice'
            ? `Factura ${docNumber} de ${payeeRef.name} por $${amount.toLocaleString('es-CO')} creada en estado Pendiente. Archivo en Drive.`
            : `Compra ${docNumber} de ${payeeRef.name} por $${amount.toLocaleString('es-CO')} registrada como pagada. Archivo en Drive.`,
        id,
      }
    }

    case 'markInvoiceAsPaid': {
      if (!ctx?.latestAttachment) {
        return {
          success: false,
          message: 'No encuentro el comprobante adjunto. Súbelo de nuevo en el mensaje.',
        }
      }
      const invoiceId = String(args.invoiceId ?? '')
      const supplierName = String(args.supplierName ?? '').trim()
      const docNumber = String(args.docNumber ?? '').trim()
      const paidDateStr = String(args.paidDate ?? '').trim()
      if (!invoiceId || !supplierName || !docNumber || !paidDateStr) {
        return { success: false, message: 'Faltan datos para cruzar el pago (invoiceId, proveedor, número, fecha).' }
      }

      // Verifica que la transaction exista y esté pending.
      const existing = await financeService.getById(companyId, invoiceId)
      if (!existing) return { success: false, message: 'No encontré esa factura.' }
      if (existing.status !== 'pending') {
        return { success: false, message: 'Esa factura no está pendiente — no se puede cruzar.' }
      }

      const dataUrl = ctx.latestAttachment.dataUrl
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      const fns = await getAppFunctions()
      const uploadFn = httpsCallable<
        {
          companyId: string
          docType: 'Factura' | 'Pago' | 'Compra'
          supplierName: string
          docNumber: string
          date: string
          fileBase64: string
          fileName: string
          mimeType: string
        },
        { driveFileId: string; webViewLink: string; fileName: string }
      >(fns, 'uploadDocumentToDrive')

      void reportProgressClient(toolCallId, { label: 'Subiendo comprobante a Drive', status: 'running' })
      const uploadRes = await uploadFn({
        companyId,
        docType: 'Pago',
        supplierName,
        docNumber,
        date: paidDateStr,
        fileBase64: base64,
        fileName: ctx.latestAttachment.name,
        mimeType: ctx.latestAttachment.contentType,
      })

      const paidTs = toTimestamp(paidDateStr)
      const paymentProof: PayableFile = {
        driveFileId: uploadRes.data.driveFileId,
        driveWebViewLink: uploadRes.data.webViewLink,
        fileName: uploadRes.data.fileName,
        mimeType: ctx.latestAttachment.contentType,
        uploadedAt: Timestamp.now(),
      }

      await financeService.update(companyId, invoiceId, {
        status: 'paid',
        paidDate: paidTs,
        paymentProof,
      } as Partial<TransactionFormData>)

      void reportProgressClient(toolCallId, { label: 'Cruce completado', status: 'done' })

      return {
        success: true,
        message: `Factura ${docNumber} de ${supplierName} marcada como Pagada. Comprobante archivado en Drive.`,
        id: invoiceId,
      }
    }

    case 'reconcileBank': {
      const functions = await getAppFunctions()
      void reportProgressClient(toolCallId, { label: 'Iniciando conciliación', status: 'running' })

      const fn = httpsCallable<
        { companyId: string; statementId?: string; toolCallId?: string },
        {
          statementId: string
          periodStart: string
          periodEnd: string
          rappiCommission: number
          rappiStatus: string
          tcRetencion: number
          tcStatus: string
          partialCount: number
          posRappiGross: number
          inflows: number
        }
      >(functions, 'reconcileBankStatement')
      const res = await fn({
        companyId,
        statementId: args.statementId ? String(args.statementId) : undefined,
        toolCallId,
      })
      const r = res.data

      void reportProgressClient(toolCallId, { label: 'Conciliación finalizada', status: 'done' })

      const parts: string[] = [`Extracto ${r.periodStart}..${r.periodEnd} conciliado.`]
      if (r.rappiStatus === 'derived') {
        parts.push(`Comisión Rappi derivada: $${r.rappiCommission.toLocaleString('es-CO')}`)
      } else if (r.rappiStatus === 'partial') {
        parts.push('Rappi quedó parcial (falta POS o depósito) — revisar.')
      }
      if (r.tcStatus === 'derived') {
        parts.push(`Retención datáfono derivada: $${r.tcRetencion.toLocaleString('es-CO')}`)
      } else if (r.tcStatus === 'partial') {
        parts.push('Datáfono quedó parcial — revisar.')
      }
      if (r.partialCount > 0) parts.push(`${r.partialCount} movimientos requieren revisión.`)

      return { success: true, message: parts.join(' ') }
    }

    default:
      return { success: false, message: `Herramienta desconocida: ${toolName}` }
  }
}
