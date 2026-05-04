import { useState } from 'react'
import { Check, X, AlertTriangle, UserPlus, UserMinus, Briefcase, DollarSign, Pencil, Trash2, Wallet, PlusCircle, CalendarDays, CheckCircle2, Split } from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionType = 'create' | 'update' | 'delete'

interface ConfirmationCardProps {
  toolName: string
  args: Record<string, unknown>
  onConfirm: () => void
  onCancel: () => void
}

const TOOL_CONFIG: Record<string, { label: string; type: ActionType; icon: typeof UserPlus }> = {
  createEmployee: { label: 'Crear Empleado', type: 'create', icon: UserPlus },
  updateEmployee: { label: 'Actualizar Empleado', type: 'update', icon: Pencil },
  deleteEmployee: { label: 'Eliminar Empleado', type: 'delete', icon: UserMinus },
  createSupplier: { label: 'Crear Proveedor', type: 'create', icon: Briefcase },
  updateSupplier: { label: 'Actualizar Proveedor', type: 'update', icon: Pencil },
  deleteSupplier: { label: 'Eliminar Proveedor', type: 'delete', icon: Trash2 },
  createTransaction: { label: 'Crear Transacción', type: 'create', icon: DollarSign },
  createSplitExpense: { label: 'Crear Gasto Compartido', type: 'create', icon: Split },
  updateBudget: { label: 'Actualizar Presupuesto', type: 'update', icon: Wallet },
  addBudgetItem: { label: 'Agregar Item de Presupuesto', type: 'create', icon: PlusCircle },
  createPayrollDraft: { label: 'Crear Borrador de Nómina', type: 'create', icon: CalendarDays },
  executeMonthClosing: { label: 'Ejecutar Cierre de Mes', type: 'create', icon: CheckCircle2 },
}

const PAYEE_TYPE_LABELS: Record<string, string> = {
  partner: 'Socio',
  employee: 'Empleado',
  supplier: 'Proveedor',
  external: 'Tercero',
}

const TYPE_STYLES: Record<ActionType, { bg: string; border: string; icon: string; button: string }> = {
  create: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'text-emerald-600',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  update: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  delete: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
}

// Fields that should not be shown to the user
const HIDDEN_FIELDS = new Set(['id', 'splits', 'totalAmount', 'splitMode'])

function formatFieldName(key: string): string {
  const labels: Record<string, string> = {
    name: 'Nombre',
    identification: 'Identificación',
    role: 'Cargo',
    department: 'Departamento',
    email: 'Correo',
    phone: 'Teléfono',
    salary: 'Salario',
    startDate: 'Fecha inicio',
    status: 'Estado',
    category: 'Categoría',
    contactName: 'Contacto',
    contractStart: 'Inicio contrato',
    contractEnd: 'Fin contrato',
    concept: 'Concepto',
    amount: 'Monto',
    type: 'Tipo',
    date: 'Fecha',
    notes: 'Notas',
    year: 'Año',
    month: 'Mes',
    periodLabel: 'Periodo',
    employeeCount: 'Empleados',
    totalNetPay: 'Neto a Pagar',
    totalEarnings: 'Total Devengado',
    totalDeductions: 'Total Deducciones',
    generateRecurring: 'Generar Recurrentes',
    pendingRecurringCount: 'Recurrentes Pendientes',
    payeeType: 'Le debemos a',
    payeeName: 'Nombre',
    targetCompanyName: 'Local',
  }
  return labels[key] ?? key
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (key === 'salary' || key === 'amount') {
    return `$${Number(value).toLocaleString('es-CL')}`
  }
  if (key === 'totalNetPay' || key === 'totalEarnings' || key === 'totalDeductions') {
    return `$${Number(value).toLocaleString('es-CL')}`
  }
  if (key === 'generateRecurring') {
    return value ? 'Sí' : 'No'
  }
  if (key === 'type') {
    return value === 'income' ? 'Ingreso' : value === 'expense' ? 'Gasto' : String(value)
  }
  if (key === 'payeeType') {
    return PAYEE_TYPE_LABELS[String(value)] ?? String(value)
  }
  if (key === 'status') {
    const statusLabels: Record<string, string> = {
      active: 'Activo',
      inactive: 'Inactivo',
      paid: 'Pagado',
      pending: 'Pendiente',
      expired: 'Expirado',
    }
    return statusLabels[String(value)] ?? String(value)
  }
  return String(value)
}

interface SplitItem {
  companyName: string
  amount?: number
  percentage?: number
}

function renderSplits(args: Record<string, unknown>) {
  const splits = (args.splits as SplitItem[] | undefined) ?? []
  const totalAmount = Number(args.totalAmount ?? 0)
  const mode = String(args.splitMode ?? 'equal')

  const computed = splits.map((s, i, arr) => {
    if (mode === 'amounts' && typeof s.amount === 'number') return s.amount
    if (mode === 'percentages' && typeof s.percentage === 'number') {
      return Math.round((totalAmount * s.percentage) / 100)
    }
    // equal split
    const each = Math.round(totalAmount / arr.length)
    if (i === arr.length - 1) {
      const sum = each * (arr.length - 1)
      return totalAmount - sum
    }
    return each
  })

  const modeLabel = mode === 'equal' ? 'partes iguales' : mode === 'percentages' ? 'porcentajes' : 'montos custom'

  return (
    <div className="rounded-lg bg-white/40 dark:bg-white/5 p-2.5 mb-2">
      <div className="text-xs text-mid-gray font-medium mb-1.5">
        División entre {splits.length} locales · {modeLabel}
      </div>
      <div className="space-y-1">
        {splits.map((s, i) => (
          <div key={`${s.companyName}-${i}`} className="flex items-baseline justify-between text-xs">
            <span className="text-dark-graphite font-medium">{s.companyName}</span>
            <span className="text-dark-graphite tabular-nums">
              ${computed[i].toLocaleString('es-CL')}
              {mode === 'percentages' && s.percentage != null && (
                <span className="text-mid-gray ml-1">({s.percentage}%)</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border/50 flex items-baseline justify-between text-xs font-semibold">
        <span className="text-graphite">Total</span>
        <span className="text-dark-graphite tabular-nums">${totalAmount.toLocaleString('es-CL')}</span>
      </div>
    </div>
  )
}

export function ConfirmationCard({ toolName, args, onConfirm, onCancel }: ConfirmationCardProps) {
  const [loading, setLoading] = useState(false)
  const config = TOOL_CONFIG[toolName] ?? { label: toolName, type: 'create' as ActionType, icon: Check }
  const styles = TYPE_STYLES[config.type]
  const Icon = config.icon

  const fields = Object.entries(args).filter(([key]) => !HIDDEN_FIELDS.has(key))
  const isSplit = toolName === 'createSplitExpense'

  async function handleConfirm() {
    setLoading(true)
    onConfirm()
  }

  return (
    <div className={cn('mx-4 my-2 rounded-xl border p-4', styles.bg, styles.border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center bg-white/60 dark:bg-white/10', styles.icon)}>
          <Icon size={14} strokeWidth={1.5} />
        </div>
        <span className="text-sm font-semibold text-dark-graphite">{config.label}</span>
        {config.type === 'delete' && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle size={12} />
            Irreversible
          </span>
        )}
      </div>

      {/* Split breakdown (solo para createSplitExpense) */}
      {isSplit && renderSplits(args)}

      {/* Fields */}
      <div className="space-y-1.5 mb-4">
        {fields.map(([key, value]) => (
          <div key={key} className="flex items-baseline gap-2 text-xs">
            <span className="text-mid-gray font-medium min-w-[80px] sm:min-w-[100px] shrink-0">{formatFieldName(key)}:</span>
            <span className="text-dark-graphite">{formatValue(key, value)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            styles.button,
            loading && 'opacity-60 cursor-not-allowed'
          )}
        >
          <Check size={12} />
          {loading ? 'Ejecutando...' : 'Confirmar'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-mid-gray hover:text-dark-graphite hover:bg-white/60 transition-colors"
        >
          <X size={12} />
          Cancelar
        </button>
      </div>
    </div>
  )
}
