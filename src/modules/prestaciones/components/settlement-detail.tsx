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
import { useSettlement, useSettlementMutation, useSettlementDelete } from '../hooks'
import { exportSettlementSlip } from './settlement-pdf'
import { SETTLEMENT_STATUS_LABELS, SETTLEMENT_STATUS_COLORS, type SettlementItem, type SettlementStatus } from '../types'

export function SettlementDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { can } = usePermissions()
  const canEdit = can('prestaciones', 'create')
  const { data: settlement, loading } = useSettlement(id)
  const updateMutation = useSettlementMutation()
  const deleteMutation = useSettlementDelete()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)

  async function handleApprove() {
    if (!settlement || !id) return
    await updateMutation.mutateAsync({ id, status: 'approved' as SettlementStatus })
  }

  async function handleMarkPaid() {
    if (!settlement || !id) return
    await updateMutation.mutateAsync({ id, status: 'paid' as SettlementStatus })
  }

  async function handleDelete() {
    if (!id) return
    await deleteMutation.mutateAsync(id)
    setDeleteOpen(false)
    navigate('/prestaciones')
  }

  async function handleExportSlip(item: SettlementItem) {
    if (!settlement || !selectedCompany) return
    setExportingId(item.employeeId)
    try {
      await exportSettlementSlip(item, settlement, selectedCompany.name)
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

  if (!settlement) {
    return (
      <PageTransition>
        <div className="p-6 text-center text-mid-gray">Liquidacion no encontrada.</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/prestaciones')}
            className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div>
            <h1 className="text-heading font-semibold text-dark-graphite">
              {settlement.periodLabel}
            </h1>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-caption font-medium border mt-1 ${SETTLEMENT_STATUS_COLORS[settlement.status]}`}>
              {SETTLEMENT_STATUS_LABELS[settlement.status]}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {settlement.status === 'draft' && (
              <button
                onClick={handleApprove}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-blue-200 text-blue-700 text-body font-medium transition-all hover:bg-blue-50"
              >
                <CheckCircle2 size={14} strokeWidth={1.5} />
                Aprobar
              </button>
            )}
            {settlement.status === 'approved' && (
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Empleados', value: settlement.employeeCount },
          { label: 'Tipo', value: settlement.typeLabel },
          { label: 'Total a Pagar', value: formatCurrency(settlement.totalAmount) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="text-caption text-mid-gray">{kpi.label}</div>
            <div className="text-subheading font-semibold mt-1 text-dark-graphite">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Termination date */}
      {settlement.terminationDate && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-body text-amber-800">
          Fecha de terminacion: <strong>{settlement.terminationDate}</strong>
        </div>
      )}

      {/* Employee Items */}
      <div className="space-y-3">
        {settlement.items.map((item) => (
          <div key={item.employeeId} className="bg-surface-elevated rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-body font-medium text-dark-graphite">{item.employeeName}</span>
                <span className="text-caption text-mid-gray ml-2">{item.employeeRole} — {item.employeeDepartment}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body font-semibold text-dark-graphite">{formatCurrency(item.totalAmount)}</span>
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

            {/* Concepts breakdown */}
            <div className="space-y-2">
              {item.concepts.map((concept, i) => (
                <div key={i} className="bg-card-bg/50 rounded-lg p-3">
                  <div className="flex justify-between text-body font-medium mb-1">
                    <span className="text-graphite">{concept.label}</span>
                    <span className="text-dark-graphite">{formatCurrency(concept.amount)}</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-0.5 text-caption text-mid-gray">
                    <div className="flex justify-between">
                      <span>Periodo</span>
                      <span>{concept.periodStart} a {concept.periodEnd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dias</span>
                      <span>{concept.daysWorked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salario</span>
                      <span>{formatCurrency(concept.baseSalary)}</span>
                    </div>
                    {concept.auxilioTransporte > 0 && (
                      <div className="flex justify-between">
                        <span>Auxilio</span>
                        <span>{formatCurrency(concept.auxilioTransporte)}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-mid-gray/60 mt-1 italic">{concept.formula}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {settlement.notes && (
        <div className="mt-6 p-4 bg-card-bg rounded-xl">
          <div className="text-caption text-mid-gray mb-1">Notas</div>
          <div className="text-body text-graphite">{settlement.notes}</div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Liquidacion"
        description={`¿Estas seguro de eliminar la liquidacion "${settlement.periodLabel}"? Esta accion no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
