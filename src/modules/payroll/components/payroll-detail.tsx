import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, CheckCircle2 } from 'lucide-react'
import { PageTransition } from '@/core/ui/page-transition'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { formatCurrency } from '@/core/utils/format'
import { TableSkeleton } from '@/core/ui/skeleton'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { usePayroll, usePayrollMutation, usePayrollDelete } from '../hooks'
import { syncPayrollTransaction } from '../transaction-generator'
import { exportPayrollSlip } from './payroll-pdf'
import { OVERTIME_LABELS, type PayrollItem, type PayrollStatus } from '../types'

const STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobada',
  paid: 'Pagada',
}

const STATUS_COLORS: Record<PayrollStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function PayrollDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { can } = usePermissions()
  const canEdit = can('payroll', 'create')
  const { data: payroll, loading } = usePayroll(id)
  const updateMutation = usePayrollMutation()
  const deleteMutation = usePayrollDelete()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  async function handleApprove() {
    if (!payroll || !id) return
    await updateMutation.mutateAsync({ id, status: 'approved' })
  }

  async function handleMarkPaid() {
    if (!payroll || !id || !selectedCompany) return
    await updateMutation.mutateAsync({ id, status: 'paid', transactionCreated: true })
    if (!payroll.transactionCreated) {
      await syncPayrollTransaction(selectedCompany.id, id, payroll)
    }
  }

  async function handleDelete() {
    if (!id) return
    await deleteMutation.mutateAsync(id)
    setDeleteOpen(false)
    navigate('/payroll')
  }

  async function handleExportSlip(item: PayrollItem) {
    if (!payroll || !selectedCompany) return
    setExportingId(item.employeeId)
    try {
      await exportPayrollSlip(item, payroll, selectedCompany.name)
    } catch (err) {
      console.error('Error exporting PDF:', err)
    } finally {
      setExportingId(null)
    }
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6">
          <TableSkeleton rows={6} columns={4} />
        </div>
      </PageTransition>
    )
  }

  if (!payroll) {
    return (
      <PageTransition>
        <div className="p-6 text-center text-mid-gray">Nomina no encontrada.</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/payroll')}
            className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-heading font-semibold text-dark-graphite">
              {payroll.periodLabel}
            </h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-caption font-medium border mt-1 ${STATUS_COLORS[payroll.status]}`}>
              {STATUS_LABELS[payroll.status]}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {payroll.status === 'draft' && (
              <button
                onClick={handleApprove}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-blue-200 text-blue-700 text-body font-medium transition-all hover:bg-blue-50"
              >
                <CheckCircle2 size={14} strokeWidth={1.5} />
                Aprobar
              </button>
            )}
            {payroll.status === 'approved' && (
              <button
                onClick={handleMarkPaid}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all hover:-translate-y-px hover:shadow-md"
              >
                <CheckCircle2 size={14} strokeWidth={1.5} />
                Marcar Pagada
              </button>
            )}
            <HoverHint label="Eliminar">
              <button
                onClick={() => setDeleteOpen(true)}
                className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 size={15} strokeWidth={1.5} />
              </button>
            </HoverHint>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Empleados', value: payroll.employeeCount },
          { label: 'Total Devengados', value: formatCurrency(payroll.totalEarnings) },
          { label: 'Total Deducciones', value: formatCurrency(payroll.totalDeductions), red: true },
          { label: 'Neto a Pagar', value: formatCurrency(payroll.totalNetPay) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="text-caption text-mid-gray">{kpi.label}</div>
            <div className={`text-subheading font-semibold mt-1 ${kpi.red ? 'text-red-500' : 'text-dark-graphite'}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Employee Items */}
      <div className="space-y-3">
        {payroll.items.map((item) => (
          <div key={item.employeeId} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-body font-medium text-dark-graphite">{item.employeeName}</span>
                <span className="text-caption text-mid-gray ml-2">{item.employeeRole} — {item.employeeDepartment}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body font-semibold text-dark-graphite">{formatCurrency(item.netPay)}</span>
                <button
                  onClick={() => handleExportSlip(item)}
                  disabled={exportingId === item.employeeId}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-input-border text-caption text-graphite hover:bg-bone transition-colors disabled:opacity-60"
                >
                  <Download size={12} strokeWidth={1.5} />
                  {exportingId === item.employeeId ? 'Exportando...' : 'PDF'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1 text-caption">
              <div className="flex justify-between">
                <span className="text-mid-gray">Salario Base</span>
                <span className="text-graphite">{formatCurrency(item.baseSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mid-gray">Auxilio Transporte</span>
                <span className="text-graphite">{formatCurrency(item.auxilioTransporte)}</span>
              </div>
              {item.overtime.map((ot, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-mid-gray">{OVERTIME_LABELS[ot.type]} ({ot.hours}h)</span>
                  <span className="text-graphite">{formatCurrency(item.overtimeTotal)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-mid-gray">Salud (4%)</span>
                <span className="text-red-500">-{formatCurrency(item.healthDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mid-gray">Pension (4%)</span>
                <span className="text-red-500">-{formatCurrency(item.pensionDeduction)}</span>
              </div>
              {item.additionalDeductions.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-mid-gray">{d.concept}</span>
                  <span className="text-red-500">-{formatCurrency(d.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {payroll.notes && (
        <div className="mt-6 p-4 bg-card-bg rounded-xl">
          <div className="text-caption text-mid-gray mb-1">Notas</div>
          <div className="text-body text-graphite">{payroll.notes}</div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Nomina"
        description={`¿Estas seguro de eliminar la nomina de ${payroll.periodLabel}? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
