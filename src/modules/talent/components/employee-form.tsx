import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { talentService } from '../services'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite placeholder:text-smoke focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

export function EmployeeForm() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    role: '',
    department: '',
    email: '',
    phone: '',
    salary: '',
    startDate: '',
    status: 'active' as 'active' | 'inactive',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return
    setSubmitting(true)
    try {
      await talentService.create(selectedCompany.id, {
        name: form.name,
        role: form.role,
        department: form.department,
        email: form.email,
        phone: form.phone,
        salary: Number(form.salary),
        startDate: Timestamp.fromDate(new Date(form.startDate)),
        status: form.status,
      })
      navigate('/talent')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Nuevo Empleado" />

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Nombre</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Nombre completo"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cargo</label>
              <input
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                placeholder="Título del puesto"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Departamento</label>
              <input
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                placeholder="Departamento"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="correo@empresa.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+1 000 000 0000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Salario</label>
              <input
                name="salary"
                type="number"
                min="0"
                value={form.salary}
                onChange={handleChange}
                required
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Fecha de Inicio</label>
              <input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Estado</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-[10px] bg-graphite text-white text-[13px] font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando...' : 'Guardar Empleado'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/talent')}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-[13px] font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
