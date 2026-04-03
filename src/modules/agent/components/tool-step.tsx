import { Loader2, CheckCircle2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const TOOL_LABELS: Record<string, string> = {
  getEmployees: 'Consultando empleados',
  getEmployee: 'Consultando empleado',
  getSuppliers: 'Consultando proveedores',
  getSupplier: 'Consultando proveedor',
  getTransactions: 'Consultando transacciones',
  getCashFlow: 'Calculando flujo de caja',
  getIncomeStatement: 'Generando estado de resultados',
  getBudgetComparison: 'Comparando presupuesto',
  getExpensesByCategory: 'Analizando gastos por categoría',
  analyzeExpensesTrend: 'Analizando tendencia de gastos',
  analyzeSupplierPrices: 'Analizando precios de proveedores',
  generateExecutiveReport: 'Generando informe ejecutivo',
  createEmployee: 'Empleado creado',
  updateEmployee: 'Empleado actualizado',
  deleteEmployee: 'Empleado eliminado',
  createSupplier: 'Proveedor creado',
  updateSupplier: 'Proveedor actualizado',
  deleteSupplier: 'Proveedor eliminado',
  createTransaction: 'Transacción creada',
}

interface ToolStepProps {
  toolName: string
  state: 'call' | 'result' | 'partial-call'
  result?: unknown
}

export function ToolStep({ toolName, state }: ToolStepProps) {
  const label = TOOL_LABELS[toolName] ?? toolName
  const isRunning = state === 'call' || state === 'partial-call'
  const isComplete = state === 'result'

  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <div className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium',
        isRunning && 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
        isComplete && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
      )}>
        {isRunning ? (
          <Loader2 size={12} className="animate-spin" />
        ) : isComplete ? (
          <CheckCircle2 size={12} />
        ) : (
          <Wrench size={12} />
        )}
        <span>{label}{isRunning ? '...' : ''}</span>
      </div>
    </div>
  )
}
