import { supplierService } from '@/modules/suppliers/services'
import { talentService } from '@/modules/talent/services'
import { financeService, budgetService } from '@/modules/finance/services'
import type { SupplierFormData } from '@/modules/suppliers/types'
import type { EmployeeFormData } from '@/modules/talent/types'
import type { TransactionFormData } from '@/modules/finance/types'
import type { MutationResult } from './execute-mutation'

/**
 * Construye una función `onUndo` para revertir una mutación recién ejecutada.
 * Devuelve `null` si el undo no es trivial (ej: deletes con docs anidados).
 *
 * Convención: el caller pasa `previousState` (el doc tal como estaba antes del
 * cambio). Para creates pasamos `null` y nos basamos en `result.id`.
 */
export function buildUndoAction(
  companyId: string,
  toolName: string,
  args: Record<string, unknown>,
  previousState: Record<string, unknown> | null,
  result: MutationResult,
): (() => Promise<void>) | null {
  switch (toolName) {
    // ─── Updates: revertir a previousState ─────────────────────────────────
    case 'updateSupplier': {
      if (!previousState) return null
      const id = String(args.id)
      const fields: (keyof SupplierFormData)[] = [
        'name',
        'category',
        'contactName',
        'email',
        'phone',
        'status',
      ]
      const revert: Partial<SupplierFormData> = {}
      for (const k of fields) {
        if (k in args && previousState[k] !== undefined) {
          ;(revert as Record<string, unknown>)[k] = previousState[k]
        }
      }
      if (Object.keys(revert).length === 0) return null
      return async () => {
        await supplierService.update(companyId, id, revert)
      }
    }

    case 'updateEmployee': {
      if (!previousState) return null
      const id = String(args.id)
      const fields: (keyof EmployeeFormData)[] = [
        'name',
        'role',
        'department',
        'email',
        'phone',
        'status',
      ]
      const revert: Partial<EmployeeFormData> = {}
      for (const k of fields) {
        if (k in args && previousState[k] !== undefined) {
          ;(revert as Record<string, unknown>)[k] = previousState[k]
        }
      }
      if (Object.keys(revert).length === 0) return null
      return async () => {
        await talentService.update(companyId, id, revert)
      }
    }

    case 'updateTransaction': {
      if (!previousState) return null
      const id = String(args.id)
      const fields: (keyof TransactionFormData)[] = [
        'concept',
        'category',
        'amount',
        'type',
        'date',
        'status',
        'notes',
      ]
      const revert: Partial<TransactionFormData> = {}
      for (const k of fields) {
        if (k in args && previousState[k] !== undefined) {
          ;(revert as Record<string, unknown>)[k] = previousState[k]
        }
      }
      if (Object.keys(revert).length === 0) return null
      return async () => {
        await financeService.update(companyId, id, revert)
      }
    }

    // ─── Budget: previousState es el item antes del cambio (o null) ────────
    case 'updateBudget':
    case 'addBudgetItem': {
      const category = String(args.category)
      const type = String(args.type) as 'income' | 'expense'
      return async () => {
        const budget = await budgetService.get(companyId)
        if (previousState && typeof previousState.amount === 'number') {
          // Restaurar el monto previo
          const idx = budget.items.findIndex((i) => i.category === category && i.type === type)
          if (idx >= 0) budget.items[idx].amount = Number(previousState.amount)
        } else {
          // El item no existía antes — eliminarlo
          budget.items = budget.items.filter((i) => !(i.category === category && i.type === type))
        }
        await budgetService.save(companyId, budget)
      }
    }

    case 'deleteBudgetItem': {
      if (!previousState) return null
      const category = String(args.category)
      const type = String(args.type) as 'income' | 'expense'
      return async () => {
        const budget = await budgetService.get(companyId)
        budget.items.push({
          category,
          type,
          amount: Number(previousState.amount ?? 0),
        })
        await budgetService.save(companyId, budget)
      }
    }

    // ─── Creates simples: borrar el doc recién creado ──────────────────────
    case 'createSupplier': {
      if (!result.id) return null
      const id = result.id
      return async () => {
        await supplierService.remove(companyId, id)
      }
    }

    case 'createEmployee': {
      if (!result.id) return null
      const id = result.id
      return async () => {
        await talentService.remove(companyId, id)
      }
    }

    case 'createTransaction': {
      if (!result.id) return null
      const id = result.id
      const targetCompanyId = result.affectedCompanyIds?.[0] ?? companyId
      return async () => {
        await financeService.remove(targetCompanyId, id)
      }
    }

    // ─── Casos no triviales ────────────────────────────────────────────────
    // deletes (deleteEmployee/Supplier/Transaction) requieren reconstruir el
    // doc completo con sub-colecciones; createSplitExpense crea N docs.
    // Para no romper integridad devolvemos null y el toast mostrará
    // "Deshacer próximamente" en lugar del botón.
    default:
      return null
  }
}
