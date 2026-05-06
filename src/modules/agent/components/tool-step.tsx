import { Loader2, CheckCircle2, Wrench, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToolProgress } from '../hooks/use-tool-progress'

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
  // Document tools
  getContracts: 'Consultando contratos',
  getContractTemplates: 'Consultando plantillas de contratos',
  getExpiringContracts: 'Revisando vencimientos de contratos',
  // Alerts
  getBusinessAlerts: 'Generando alertas del negocio',
  // Settings
  updateBudget: 'Presupuesto actualizado',
  addBudgetItem: 'Item de presupuesto agregado',
  // Search
  searchAll: 'Buscando en todos los módulos',
  // Chart & Export
  generateChart: 'Generando gráfico',
  exportReport: 'Exportando reporte',
}

// Tools que reportan progreso incremental (Wave 2.3). Sólo en estas vale
// la pena suscribirse a `toolProgress/{toolCallId}`.
const TOOLS_WITH_PROGRESS = new Set([
  'generateExecutiveReport',
  'executeMonthClosing',
  'triggerPosReconcile',
])

interface ToolStepProps {
  toolName: string
  toolCallId?: string
  state: 'call' | 'result' | 'partial-call'
  result?: unknown
}

export function ToolStep({ toolName, toolCallId, state }: ToolStepProps) {
  const label = TOOL_LABELS[toolName] ?? toolName
  const isRunning = state === 'call' || state === 'partial-call'
  const isComplete = state === 'result'
  const showProgress = TOOLS_WITH_PROGRESS.has(toolName) && isRunning

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-caption font-medium',
          isRunning && 'bg-warning-bg text-warning-text',
          isComplete && 'bg-positive-bg text-positive-text',
        )}>
          {isRunning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : isComplete ? (
            <CheckCircle2 size={12} />
          ) : (
            <Wrench size={12} />
          )}
          <span>{label}{isRunning ? '…' : ''}</span>
        </div>
      </div>

      {showProgress && toolCallId && (
        <ProgressList toolCallId={toolCallId} />
      )}
    </div>
  )
}

function ProgressList({ toolCallId }: { toolCallId: string }) {
  const { steps } = useToolProgress(toolCallId)

  if (steps.length === 0) return null

  // El último step es el que está activo si su status es 'running'. Los
  // anteriores quedan como 'done'.
  const lastIdx = steps.length - 1

  return (
    <ul className="ml-3 space-y-1 border-l border-border/60 pl-4">
      {steps.map((step, i) => {
        const isLast = i === lastIdx
        const isRunningStep = isLast && step.status === 'running'
        const isErrorStep = step.status === 'error'
        const isDoneStep = !isRunningStep && !isErrorStep

        return (
          <li
            key={`${step.ts}-${i}`}
            className="flex items-center gap-2 text-caption"
          >
            <Dot
              variant={
                isErrorStep ? 'error' : isRunningStep ? 'running' : 'done'
              }
            />
            <span
              className={cn(
                isDoneStep && 'text-mid-gray',
                isRunningStep && 'text-graphite font-medium',
                isErrorStep && 'text-negative-text',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Dot({ variant }: { variant: 'pending' | 'running' | 'done' | 'error' }) {
  if (variant === 'running') {
    return <Loader2 size={10} className="text-info-text animate-spin shrink-0" />
  }
  if (variant === 'error') {
    return <AlertCircle size={10} className="text-negative-text shrink-0" />
  }
  if (variant === 'done') {
    return (
      <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-positive-bg shrink-0">
        <CheckCircle2 size={10} className="text-positive-text" />
      </span>
    )
  }
  // pending
  return <span className="inline-block h-2 w-2 rounded-full bg-smoke shrink-0" />
}
