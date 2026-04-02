import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, Trash2, Edit3, Save, X } from 'lucide-react'
import { ContractExport } from './contract-export'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { StatusBadge } from '@/core/ui/status-badge'
import { SelectInput } from '@/core/ui/select-input'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { useCompany } from '@/core/hooks/use-company'
import { useContract } from '../hooks'
import { contractService } from '../services'
import { ContractPreview } from './contract-preview'
import { formatCurrency } from '@/core/utils/format'
import { Skeleton } from '@/core/ui/skeleton'
import type { ContractClause } from '../types'
import type { ContractStatus } from '@/core/types'
import type { Timestamp } from 'firebase/firestore'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  terminated: 'Terminado',
  expired: 'Vencido',
}

const STATUS_VARIANT: Record<string, 'active' | 'pending' | 'inactive'> = {
  draft: 'pending',
  active: 'active',
  terminated: 'inactive',
  expired: 'inactive',
}

function formatDate(ts: Timestamp | string | undefined): string {
  if (!ts) return '—'
  try {
    const date = typeof ts === 'string' ? new Date(ts)
      : typeof ts === 'object' && 'toDate' in ts ? ts.toDate()
      : typeof ts === 'object' && 'seconds' in (ts as Record<string, unknown>) ? new Date((ts as unknown as { seconds: number }).seconds * 1000)
      : null
    if (!date || isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch { return '—' }
}

export function ContractDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedCompany } = useCompany()
  const { data: contract, loading, error } = useContract(id)

  const [editing, setEditing] = useState(false)
  const [editedClauses, setEditedClauses] = useState<ContractClause[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function startEditing() {
    if (contract) {
      setEditedClauses([...contract.clauses])
      setEditing(true)
    }
  }

  function handleClauseChange(idx: number, content: string) {
    setEditedClauses((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, content } : c))
    )
  }

  async function handleSaveClauses() {
    if (!selectedCompany || !contract) return
    setSaving(true)
    try {
      await contractService.update(selectedCompany.id, contract.id, { clauses: editedClauses })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!selectedCompany || !contract) return
    await contractService.update(selectedCompany.id, contract.id, { status: newStatus as ContractStatus })
  }

  async function handleDelete() {
    if (!selectedCompany || !contract) return
    await contractService.remove(selectedCompany.id, contract.id)
    navigate('/contracts')
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-5">
          <Skeleton className="h-6 w-48 rounded" />
          <div className="bg-surface rounded-xl card-elevated p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageTransition>
    )
  }

  if (error || !contract) {
    return (
      <PageTransition>
        <div className="text-body text-mid-gray py-8 text-center">Contrato no encontrado</div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="print:hidden">
        <PageHeader title={`Contrato — ${contract.employeeName}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/contracts')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <ArrowLeft size={15} strokeWidth={1.5} />
              Volver
            </button>
          </div>
        </PageHeader>

        {/* Info header */}
        <div className="bg-surface rounded-xl card-elevated p-5 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Empleado</div>
              <div className="text-body font-medium text-dark-graphite">{contract.employeeName}</div>
              <div className="text-caption text-mid-gray">{contract.employeeIdentification}</div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Cargo</div>
              <div className="text-body text-graphite">{contract.position}</div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Salario</div>
              <div className="text-body font-medium text-dark-graphite">{formatCurrency(contract.salary)}</div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Estado</div>
              <StatusBadge variant={STATUS_VARIANT[contract.status] ?? 'pending'} label={STATUS_LABELS[contract.status] ?? contract.status} />
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Inicio</div>
              <div className="text-body text-graphite">{formatDate(contract.startDate)}</div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Terminación</div>
              <div className="text-body text-graphite">{formatDate(contract.endDate)}</div>
            </div>
            <div>
              <div className="text-caption uppercase tracking-wider text-mid-gray mb-0.5">Plantilla</div>
              <div className="text-body text-graphite">{contract.templateName}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-5">
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Edit3 size={14} strokeWidth={1.5} />
              Editar cláusulas
            </button>
          ) : (
            <>
              <button
                onClick={handleSaveClauses}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60"
              >
                <Save size={14} strokeWidth={1.5} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
              >
                <X size={14} strokeWidth={1.5} />
                Cancelar
              </button>
            </>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <div className="w-40">
              <SelectInput
                value={contract.status}
                onChange={handleStatusChange}
                options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <ContractExport
              clauses={contract.clauses}
              title={contract.templateName}
              employeeName={contract.employeeName}
            />
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
            >
              <Printer size={14} strokeWidth={1.5} />
              Imprimir
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
              title="Eliminar contrato"
            >
              <Trash2 size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Contract content */}
      {editing ? (
        <div className="bg-white rounded-xl border border-border p-8 max-w-3xl mx-auto space-y-5">
          {editedClauses
            .sort((a, b) => a.order - b.order)
            .map((clause, idx) => (
              <div key={clause.id}>
                <h3 className="text-body font-semibold text-dark-graphite mb-1.5">{clause.title}</h3>
                <textarea
                  value={clause.content}
                  onChange={(e) => handleClauseChange(idx, e.target.value)}
                  disabled={clause.isRequired && false}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200 resize-y"
                />
              </div>
            ))}
        </div>
      ) : (
        <ContractPreview
          clauses={contract.clauses}
          title={contract.templateName}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar Contrato"
        description={`¿Estás seguro de que deseas eliminar el contrato de ${contract.employeeName}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </PageTransition>
  )
}
