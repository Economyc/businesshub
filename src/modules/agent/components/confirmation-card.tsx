import { useEffect, useState } from 'react'
import { Check, X, AlertTriangle, UserPlus, UserMinus, Briefcase, DollarSign, Pencil, Trash2, Wallet, PlusCircle, CheckCircle2, Split, ArrowRight, Loader2, ListChecks, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompany } from '@/core/hooks/use-company'
import { supplierService } from '@/modules/suppliers/services'
import { talentService } from '@/modules/talent/services'
import { financeService, budgetService } from '@/modules/finance/services'
import { StaleDateWarning } from '@/modules/finance/components/stale-date-warning'
import { isDateTooOld } from '@/modules/finance/utils/date-validation'

type ActionType = 'create' | 'update' | 'delete'

interface ConfirmationCardProps {
  toolName: string
  args: Record<string, unknown>
  onConfirm: (previousState: Record<string, unknown> | null) => void
  onCancel: () => void
  userQuote?: string
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
  updateTransaction: { label: 'Actualizar Transacción', type: 'update', icon: Pencil },
  deleteTransaction: { label: 'Eliminar Transacción', type: 'delete', icon: Trash2 },
  createPayableDocument: { label: 'Subir Documento (Factura/Compra)', type: 'create', icon: PlusCircle },
  markInvoiceAsPaid: { label: 'Cruzar Pago con Factura', type: 'update', icon: CheckCircle2 },
  quickMarkInvoiceAsPaid: { label: 'Marcar Factura como Pagada', type: 'update', icon: CheckCircle2 },
  bulkMarkAsPaid: { label: 'Marcar Facturas como Pagadas', type: 'update', icon: ListChecks },
  bulkSetPriority: { label: 'Cambiar Prioridad', type: 'update', icon: Flag },
  updateBudget: { label: 'Actualizar Presupuesto', type: 'update', icon: Wallet },
  addBudgetItem: { label: 'Agregar Item de Presupuesto', type: 'create', icon: PlusCircle },
  deleteBudgetItem: { label: 'Eliminar Item de Presupuesto', type: 'delete', icon: Trash2 },
  executeMonthClosing: { label: 'Ejecutar Cierre de Mes', type: 'create', icon: CheckCircle2 },
  reconcileBank: { label: 'Conciliar Extracto Bancario', type: 'create', icon: Wallet },
}

const PAYEE_TYPE_LABELS: Record<string, string> = {
  partner: 'Socio',
  employee: 'Empleado',
  supplier: 'Proveedor',
  external: 'Tercero',
}

const TYPE_STYLES: Record<ActionType, { bg: string; border: string; icon: string; button: string }> = {
  create: {
    bg: 'bg-positive-bg',
    border: 'border-positive-text/20',
    icon: 'text-positive-text',
    button: 'bg-positive-text hover:opacity-90 text-white',
  },
  update: {
    bg: 'bg-info-bg',
    border: 'border-info-text/20',
    icon: 'text-info-text',
    button: 'bg-info-text hover:opacity-90 text-white',
  },
  delete: {
    bg: 'bg-negative-bg',
    border: 'border-negative-text/20',
    icon: 'text-negative-text',
    button: 'bg-negative-text hover:opacity-90 text-white',
  },
}

// Fields that should not be shown to the user
const HIDDEN_FIELDS = new Set(['id', 'splits', 'totalAmount', 'splitMode', 'items', 'summary'])

function formatFieldName(key: string): string {
  const labels: Record<string, string> = {
    priority: 'Prioridad',
    documentKind: 'Tipo doc.',
    paidDate: 'Fecha pago',
    supplierName: 'Proveedor',
    name: 'Nombre',
    identification: 'Identificación',
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
  if (key === 'priority') {
    return value === 'immediate' ? 'Urgente' : value === 'waiting' ? 'Normal' : String(value)
  }
  if (key === 'documentKind') {
    return value === 'invoice' ? 'Factura' : value === 'purchase' ? 'Compra' : String(value)
  }
  // Firestore Timestamp-shaped value
  if (value && typeof value === 'object' && 'seconds' in (value as Record<string, unknown>)) {
    const seconds = Number((value as { seconds: number }).seconds)
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString().slice(0, 10)
    }
  }
  return String(value)
}

interface BulkItem {
  id: string
  concept?: string
  amount?: number
}

function renderBulkItems(args: Record<string, unknown>, toolName: string) {
  const items = (args.items as BulkItem[] | undefined) ?? []
  if (items.length === 0) return null
  const summary = args.summary ? String(args.summary) : null
  const priority = args.priority as string | undefined
  const headerExtra =
    toolName === 'bulkSetPriority' && priority
      ? ` · prioridad → ${priority === 'immediate' ? 'Urgente' : 'Normal'}`
      : ''
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const showTotal = items.some((it) => typeof it.amount === 'number')

  return (
    <div className="rounded-lg bg-card-bg p-4 mb-4 border border-border/60">
      <div className="text-caption text-mid-gray font-medium mb-2">
        {summary ?? `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        {headerExtra}
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {items.map((it, i) => (
          <div key={`${it.id}-${i}`} className="flex items-baseline justify-between gap-2 text-caption">
            <span className="text-dark-graphite truncate">{it.concept ?? it.id}</span>
            {typeof it.amount === 'number' && (
              <span className="text-dark-graphite tabular-nums shrink-0">
                ${Number(it.amount).toLocaleString('es-CO')}
              </span>
            )}
          </div>
        ))}
      </div>
      {showTotal && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-baseline justify-between text-caption font-semibold">
          <span className="text-graphite">Total</span>
          <span className="text-dark-graphite tabular-nums">${total.toLocaleString('es-CO')}</span>
        </div>
      )}
    </div>
  )
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
    <div className="rounded-lg bg-card-bg p-4 mb-4 border border-border/60">
      <div className="text-caption text-mid-gray font-medium mb-2">
        División entre {splits.length} locales · {modeLabel}
      </div>
      <div className="space-y-1">
        {splits.map((s, i) => (
          <div key={`${s.companyName}-${i}`} className="flex items-baseline justify-between text-caption">
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
      <div className="mt-2 pt-2 border-t border-border/60 flex items-baseline justify-between text-caption font-semibold">
        <span className="text-graphite">Total</span>
        <span className="text-dark-graphite tabular-nums">${totalAmount.toLocaleString('es-CL')}</span>
      </div>
    </div>
  )
}

// Fetches the document targeted by an update tool. Returns null if the tool is
// not an update or the doc cannot be fetched.
async function fetchPreviousState(
  companyId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    if (toolName === 'updateSupplier') {
      const id = String(args.id)
      const doc = await supplierService.getById(companyId, id)
      return (doc as Record<string, unknown> | null) ?? null
    }
    if (toolName === 'updateEmployee') {
      const id = String(args.id)
      const doc = await talentService.getById(companyId, id)
      return (doc as Record<string, unknown> | null) ?? null
    }
    if (toolName === 'updateTransaction') {
      const id = String(args.id)
      const doc = await financeService.getById(companyId, id)
      return (doc as Record<string, unknown> | null) ?? null
    }
    if (toolName === 'updateBudget' || toolName === 'addBudgetItem' || toolName === 'deleteBudgetItem') {
      const budget = await budgetService.get(companyId)
      const category = String(args.category)
      const type = String(args.type)
      const item = budget.items.find((it) => it.category === category && it.type === type)
      // Snapshot the matching item (or null if not present yet)
      return item ? { ...item } : null
    }
  } catch (err) {
    console.error('[ConfirmationCard] no se pudo leer estado previo:', err)
  }
  return null
}

function isUpdateTool(toolName: string): boolean {
  return (
    toolName === 'updateSupplier' ||
    toolName === 'updateEmployee' ||
    toolName === 'updateTransaction' ||
    toolName === 'updateBudget' ||
    toolName === 'addBudgetItem' ||
    toolName === 'deleteBudgetItem'
  )
}

interface DiffRow {
  key: string
  before: unknown
  after: unknown
}

function buildDiffRows(
  toolName: string,
  args: Record<string, unknown>,
  previousState: Record<string, unknown> | null,
): DiffRow[] {
  const rows: DiffRow[] = []

  // Budget items: comparar el campo "amount" sobre la categoría/tipo
  if (toolName === 'updateBudget' || toolName === 'addBudgetItem' || toolName === 'deleteBudgetItem') {
    rows.push({
      key: 'category',
      before: previousState?.category ?? null,
      after: args.category,
    })
    rows.push({
      key: 'amount',
      before: previousState?.amount ?? null,
      after: toolName === 'deleteBudgetItem' ? null : args.amount,
    })
    return rows
  }

  // updateSupplier / updateEmployee / updateTransaction:
  // mostramos sólo los campos que vienen en args (excepto id) y que cambian.
  const entries = Object.entries(args).filter(([key]) => key !== 'id' && !HIDDEN_FIELDS.has(key))
  for (const [key, after] of entries) {
    const before = previousState ? previousState[key] : undefined
    rows.push({ key, before, after })
  }
  return rows
}

function valuesAreEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  return formatValue('', a) === formatValue('', b)
}

export function ConfirmationCard({ toolName, args, onConfirm, onCancel, userQuote }: ConfirmationCardProps) {
  const { selectedCompany } = useCompany()
  const [loading, setLoading] = useState(false)
  const [previousState, setPreviousState] = useState<Record<string, unknown> | null>(null)
  const [loadingPrev, setLoadingPrev] = useState(false)
  const config = TOOL_CONFIG[toolName] ?? { label: toolName, type: 'create' as ActionType, icon: Check }
  const styles = TYPE_STYLES[config.type]
  const Icon = config.icon
  const isUpdate = isUpdateTool(toolName)
  const isSplit = toolName === 'createSplitExpense'
  const isBulk = toolName === 'bulkMarkAsPaid' || toolName === 'bulkSetPriority'

  useEffect(() => {
    let cancelled = false
    if (!isUpdate || !selectedCompany?.id) return
    setLoadingPrev(true)
    fetchPreviousState(selectedCompany.id, toolName, args)
      .then((state) => {
        if (!cancelled) setPreviousState(state)
      })
      .finally(() => {
        if (!cancelled) setLoadingPrev(false)
      })
    return () => {
      cancelled = true
    }
    // args contiene primitivos serializables — comparación referencial es suficiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, toolName, JSON.stringify(args), isUpdate])

  const fields = Object.entries(args).filter(([key]) => !HIDDEN_FIELDS.has(key))
  const diffRows = isUpdate ? buildDiffRows(toolName, args, previousState) : []

  async function handleConfirm() {
    setLoading(true)
    onConfirm(previousState)
  }

  return (
    <div className={cn('mx-4 my-2 rounded-xl border p-4', styles.bg, styles.border)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center bg-card-bg', styles.icon)}>
          <Icon size={14} strokeWidth={1.5} />
        </div>
        <span className="text-body font-semibold text-dark-graphite">{config.label}</span>
        {config.type === 'delete' && (
          <span className="flex items-center gap-1 text-caption text-negative-text font-medium">
            <AlertTriangle size={12} />
            Irreversible
          </span>
        )}
      </div>

      {/* Split breakdown (solo para createSplitExpense) */}
      {isSplit && renderSplits(args)}

      {/* Bulk: lista de items afectados */}
      {isBulk && renderBulkItems(args, toolName)}

      {/* Update: diff antes → después */}
      {isUpdate && !isBulk && (
        <div className="mb-4">
          {loadingPrev ? (
            <div className="flex items-center gap-2 text-caption text-mid-gray">
              <Loader2 size={12} className="animate-spin" />
              Cargando estado actual…
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-card-bg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 px-4 py-2 border-b border-border/60 text-caption text-mid-gray font-medium">
                <span>Campo</span>
                <span>Antes</span>
                <span />
                <span>Después</span>
              </div>
              <div className="divide-y divide-border/60">
                {diffRows.map((row) => {
                  const unchanged = valuesAreEqual(row.before, row.after)
                  const beforeStr = formatValue(row.key, row.before)
                  const afterStr = formatValue(row.key, row.after)
                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 items-center px-4 py-2 text-caption"
                    >
                      <span className="text-mid-gray font-medium min-w-[80px]">
                        {formatFieldName(row.key)}
                      </span>
                      <span
                        className={cn(
                          'tabular-nums truncate',
                          unchanged
                            ? 'text-mid-gray'
                            : 'text-negative-text line-through',
                        )}
                      >
                        {beforeStr}
                      </span>
                      <ArrowRight size={12} className="text-mid-gray" />
                      <span
                        className={cn(
                          'tabular-nums truncate',
                          unchanged
                            ? 'text-mid-gray'
                            : 'text-positive-text font-medium',
                        )}
                      >
                        {afterStr}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / delete: lista plana de campos */}
      {!isUpdate && !isSplit && !isBulk && (
        <div className="space-y-1.5 mb-4">
          {fields.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 text-caption">
              <span className="text-mid-gray font-medium min-w-[80px] sm:min-w-[100px] shrink-0">{formatFieldName(key)}:</span>
              <span className="text-dark-graphite">{formatValue(key, value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Split: lista de campos no-split */}
      {isSplit && (
        <div className="space-y-1.5 mb-4">
          {fields.map(([key, value]) => (
            <div key={key} className="flex items-baseline gap-2 text-caption">
              <span className="text-mid-gray font-medium min-w-[80px] sm:min-w-[100px] shrink-0">{formatFieldName(key)}:</span>
              <span className="text-dark-graphite">{formatValue(key, value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Aviso de fecha sospechosa (>3 meses) — el lector IA a veces confunde el
          año. Sin checkbox: "Confirmar" es la confirmación, "Cancelar" deja
          corregir por chat. */}
      {typeof args.date === 'string' && isDateTooOld(args.date) && (
        <div className="mb-4">
          <StaleDateWarning dateISO={args.date} fieldLabel="fecha del documento" />
        </div>
      )}
      {typeof args.paidDate === 'string' && isDateTooOld(args.paidDate) && (
        <div className="mb-4">
          <StaleDateWarning dateISO={args.paidDate} fieldLabel="fecha del pago" />
        </div>
      )}

      {/* Por qué — cita corta del usuario */}
      {userQuote && userQuote.trim() && (
        <div className="mb-4 pl-3 border-l-2 border-border/60">
          <p className="text-caption text-mid-gray italic line-clamp-3">
            “{userQuote.trim()}”
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading || loadingPrev}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium transition-colors',
            styles.button,
            (loading || loadingPrev) && 'opacity-60 cursor-not-allowed',
          )}
        >
          <Check size={14} />
          {loading ? 'Ejecutando…' : 'Confirmar'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body font-medium text-mid-gray hover:text-dark-graphite hover:bg-bone transition-colors"
        >
          <X size={14} />
          Cancelar
        </button>
      </div>
    </div>
  )
}
