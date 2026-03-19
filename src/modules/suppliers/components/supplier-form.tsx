import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Timestamp } from 'firebase/firestore'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { supplierService } from '../services'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-card-bg text-body text-graphite placeholder:text-smoke focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

export function SupplierForm() {
  const navigate = useNavigate()
  const { selectedCompany } = useCompany()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    category: '',
    contactName: '',
    email: '',
    phone: '',
    contractStart: '',
    contractEnd: '',
    status: 'active' as 'active' | 'expired' | 'pending',
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
      await supplierService.create(selectedCompany.id, {
        name: form.name,
        category: form.category,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        contractStart: Timestamp.fromDate(new Date(form.contractStart)),
        contractEnd: Timestamp.fromDate(new Date(form.contractEnd)),
        status: form.status,
      })
      navigate('/suppliers')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Nuevo Proveedor" />

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
                placeholder="Nombre del proveedor"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Categoría</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                placeholder="Ej. Tecnología, Limpieza..."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Nombre de Contacto</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                required
                placeholder="Nombre del contacto"
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
                placeholder="correo@proveedor.com"
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
              <label className={labelClass}>Estado</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="active">Activo</option>
                <option value="expired">Vencido</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Inicio de Contrato</label>
              <input
                name="contractStart"
                type="date"
                value={form.contractStart}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Fin de Contrato</label>
              <input
                name="contractEnd"
                type="date"
                value={form.contractEnd}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-[10px] bg-graphite text-white text-[13px] font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando...' : 'Guardar Proveedor'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="px-5 py-2.5 rounded-[10px] border border-input-border text-graphite text-[13px] font-medium transition-all duration-200 hover:bg-bone"
          >
            Cancelar
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
