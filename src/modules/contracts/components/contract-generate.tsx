import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FileSignature } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { SelectInput } from '@/core/ui/select-input'
import { DateInput } from '@/core/ui/date-input'
import { CurrencyInput } from '@/core/ui/currency-input'
import { useCompany } from '@/core/hooks/use-company'
import { useTemplates } from '../hooks'
import { useCollection } from '@/core/hooks/use-firestore'
import { contractService } from '../services'
import { resolvePlaceholders, numberToWords } from '../defaults/placeholders'
import { ContractPreview } from './contract-preview'
import { ContractExport } from './contract-export'
import { ContractsTabs } from './contracts-tabs'
import type { ContractMetadata, ContractClause, ContractFormData } from '../types'
import type { Employee } from '@/modules/talent/types'
import type { ContractStatus } from '@/core/types'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

const STEPS = ['Plantilla', 'Datos', 'Vista previa']

export function ContractGenerate() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const { data: templates } = useTemplates()
  const { data: employees } = useCollection<Employee>('employees')

  const [step, setStep] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [metadata, setMetadata] = useState<ContractMetadata>({
    companyName: '', companyNit: '', companyAddress: '', companyLegalRep: '',
    employeeName: '', employeeIdentification: '', employeeAddress: '',
    position: '', salary: 0, salaryWords: '', paymentFrequency: 'quincenal',
    startDate: '', endDate: '', workSchedule: '', probationDays: 60, city: '',
  })

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // Auto-populate company data
  useEffect(() => {
    if (selectedCompany) {
      setMetadata((prev) => ({
        ...prev,
        companyName: selectedCompany.name,
        companyAddress: selectedCompany.location ?? '',
      }))
    }
  }, [selectedCompany?.id])

  // Auto-populate employee data
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId)
      if (emp) {
        setMetadata((prev) => ({
          ...prev,
          employeeName: emp.name,
          employeeIdentification: emp.identification ?? '',
          position: emp.role ?? prev.position,
          salary: emp.salary ?? prev.salary,
          salaryWords: numberToWords(emp.salary ?? 0),
          startDate: emp.startDate ? emp.startDate.toDate().toISOString().split('T')[0] : prev.startDate,
        }))
      }
    }
  }, [selectedEmployeeId, employees])

  // Update salary words when salary changes
  function handleSalaryChange(raw: string) {
    const num = Number(raw) || 0
    setMetadata((prev) => ({ ...prev, salary: num, salaryWords: numberToWords(num) }))
  }

  function handleField(name: string, value: string) {
    setMetadata((prev) => ({ ...prev, [name]: value }))
  }

  // Resolve clauses for preview
  function resolvedClauses(): ContractClause[] {
    if (!selectedTemplate) return []
    return selectedTemplate.clauses.map((c) => ({
      id: c.id,
      title: resolvePlaceholders(c.title, metadata),
      content: resolvePlaceholders(c.content, metadata),
      isRequired: c.isRequired,
      order: c.order,
    }))
  }

  async function handleSave(status: ContractStatus) {
    if (!selectedCompany || !selectedTemplate) return
    setSubmitting(true)
    try {
      const clauses = resolvedClauses()
      const data: ContractFormData = {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        contractType: selectedTemplate.contractType,
        employeeName: metadata.employeeName,
        employeeIdentification: metadata.employeeIdentification,
        position: metadata.position,
        salary: metadata.salary,
        startDate: metadata.startDate
          ? Timestamp.fromDate(new Date(metadata.startDate))
          : Timestamp.now(),
        status,
        clauses,
        metadata,
      }
      if (selectedEmployeeId) data.employeeId = selectedEmployeeId
      if (metadata.endDate) data.endDate = Timestamp.fromDate(new Date(metadata.endDate))
      await contractService.create(selectedCompany.id, data)
      navigate('/contracts')
    } finally {
      setSubmitting(false)
    }
  }

  const canNext = step === 0
    ? !!selectedTemplateId
    : step === 1
    ? !!metadata.employeeName && !!metadata.position && metadata.salary > 0 && !!metadata.startDate
    : true

  return (
    <PageTransition>
      <PageHeader title="Generar Contrato">
        <button
          onClick={() => navigate('/contracts')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Volver
        </button>
      </PageHeader>

      <ContractsTabs />

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-caption font-semibold transition-colors ${
              i <= step ? 'bg-dark-graphite text-white' : 'bg-bone text-mid-gray'
            }`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-caption font-medium ${i <= step ? 'text-dark-graphite' : 'text-mid-gray'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 0: Select template */}
      {step === 0 && (
        <div className="bg-surface rounded-xl card-elevated p-6">
          <h3 className="text-body font-semibold text-dark-graphite mb-4">Seleccionar Plantilla</h3>
          {templates.length === 0 ? (
            <p className="text-body text-mid-gray">
              No hay plantillas disponibles. Ve a la pestaña de Plantillas para crear o cargar las predeterminadas.
            </p>
          ) : (
            <div className="grid gap-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    selectedTemplateId === t.id
                      ? 'border-dark-graphite bg-bone/50'
                      : 'border-border hover:border-mid-gray/50 hover:bg-bone/30'
                  }`}
                >
                  <div className="font-medium text-dark-graphite">{t.name}</div>
                  <div className="text-caption text-mid-gray mt-1">{t.description}</div>
                  <div className="text-caption text-mid-gray/70 mt-1">
                    {t.position} · {t.clauses?.length ?? 0} cláusulas
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Fill metadata */}
      {step === 1 && (
        <div className="bg-surface rounded-xl card-elevated p-6">
          <h3 className="text-body font-semibold text-dark-graphite mb-4">Datos del Contrato</h3>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Nombre de la empresa</label>
              <input value={metadata.companyName} onChange={(e) => handleField('companyName', e.target.value)} className={inputClass} placeholder="Razón social" />
            </div>
            <div>
              <label className={labelClass}>NIT</label>
              <input value={metadata.companyNit} onChange={(e) => handleField('companyNit', e.target.value)} className={inputClass} placeholder="NIT de la empresa" />
            </div>
            <div>
              <label className={labelClass}>Dirección empresa</label>
              <input value={metadata.companyAddress} onChange={(e) => handleField('companyAddress', e.target.value)} className={inputClass} placeholder="Dirección del establecimiento" />
            </div>
            <div>
              <label className={labelClass}>Representante legal</label>
              <input value={metadata.companyLegalRep} onChange={(e) => handleField('companyLegalRep', e.target.value)} className={inputClass} placeholder="Nombre completo" />
            </div>

            <div className="col-span-2 border-t border-border pt-5 mt-2">
              <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-3">Datos del empleado</h4>
            </div>

            {employees.length > 0 && (
              <div>
                <label className={labelClass}>Empleado existente (opcional)</label>
                <SelectInput
                  value={selectedEmployeeId}
                  onChange={setSelectedEmployeeId}
                  options={[
                    { value: '', label: 'Ingresar datos manualmente' },
                    ...employees.map((e) => ({ value: e.id, label: `${e.name} — ${e.role}` })),
                  ]}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>Nombre del empleado</label>
              <input value={metadata.employeeName} onChange={(e) => handleField('employeeName', e.target.value)} required className={inputClass} placeholder="Nombre completo" />
            </div>
            <div>
              <label className={labelClass}>Cédula</label>
              <input value={metadata.employeeIdentification} onChange={(e) => handleField('employeeIdentification', e.target.value)} className={inputClass} placeholder="Número de cédula" />
            </div>
            <div>
              <label className={labelClass}>Dirección empleado</label>
              <input value={metadata.employeeAddress} onChange={(e) => handleField('employeeAddress', e.target.value)} className={inputClass} placeholder="Dirección de residencia" />
            </div>
            <div>
              <label className={labelClass}>Cargo</label>
              <input value={metadata.position} onChange={(e) => handleField('position', e.target.value)} required className={inputClass} placeholder="Cargo a desempeñar" />
            </div>

            <div className="col-span-2 border-t border-border pt-5 mt-2">
              <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-3">Condiciones</h4>
            </div>

            <div>
              <label className={labelClass}>Salario mensual</label>
              <CurrencyInput
                value={String(metadata.salary || '')}
                onChange={handleSalaryChange}
                required
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Frecuencia de pago</label>
              <SelectInput
                value={metadata.paymentFrequency}
                onChange={(v) => handleField('paymentFrequency', v)}
                options={[
                  { value: 'quincenal', label: 'Quincenal' },
                  { value: 'mensual', label: 'Mensual' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de inicio</label>
              <DateInput
                value={metadata.startDate}
                onChange={(v) => handleField('startDate', v)}
                required
              />
            </div>
            {selectedTemplate?.contractType !== 'indefinido' && <div>
              <label className={labelClass}>Fecha de terminación</label>
              <DateInput
                value={metadata.endDate ?? ''}
                onChange={(v) => handleField('endDate', v)}
              />
            </div>}
            <div>
              <label className={labelClass}>Horario de trabajo</label>
              <SelectInput
                value={metadata.workSchedule}
                onChange={(v) => handleField('workSchedule', v)}
                options={[
                  { value: '', label: 'Seleccionar horario' },
                  { value: 'Según programación del administrador del establecimiento', label: 'Según programación del administrador' },
                  { value: 'Lunes a sábado, 6:00 AM - 2:00 PM', label: 'Apertura — 6:00 AM a 2:00 PM' },
                  { value: 'Lunes a sábado, 2:00 PM - 10:00 PM', label: 'Medio día — 2:00 PM a 10:00 PM' },
                  { value: 'Lunes a sábado, 10:00 PM - 6:00 AM', label: 'Cierre — 10:00 PM a 6:00 AM' },
                  { value: 'Lunes a domingo con un día de descanso rotativo, según programación', label: 'Rotativo — L-D con descanso rotativo' },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Periodo de prueba (días)</label>
              <input type="number" value={metadata.probationDays ?? ''} onChange={(e) => handleField('probationDays', e.target.value)} className={inputClass} placeholder="60" />
            </div>
            <div>
              <label className={labelClass}>Ciudad</label>
              <SelectInput
                value={metadata.city}
                onChange={(v) => handleField('city', v)}
                options={[
                  { value: '', label: 'Seleccionar ciudad' },
                  { value: 'Medellín', label: 'Medellín' },
                  { value: 'Bogotá D.C.', label: 'Bogotá D.C.' },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <ContractPreview
            clauses={resolvedClauses()}
            title={selectedTemplate?.name}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={15} strokeWidth={1.5} />
          Anterior
        </button>

        <div className="flex items-center gap-3">
          {step === 2 && (
            <>
              <ContractExport
                clauses={resolvedClauses()}
                title={selectedTemplate?.name ?? ''}
                employeeName={metadata.employeeName}
              />
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] border border-input-border text-graphite text-body font-medium transition-all duration-200 hover:bg-bone disabled:opacity-60"
              >
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={() => handleSave('active')}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60"
              >
                <FileSignature size={15} strokeWidth={1.5} />
                {submitting ? 'Guardando...' : 'Crear Contrato'}
              </button>
            </>
          )}

          {step < 2 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              disabled={!canNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
              <ArrowRight size={15} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
