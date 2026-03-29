import { useState, useEffect, Fragment } from 'react'
import { Plus, MapPin, Trash2, Check, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'
import { LogoPicker } from '@/core/ui/logo-picker'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface CompanyForm {
  id: string
  name: string
  location: string
  color: string
  logo: string
  logoThumb: string
}

export function SettingsCompanies() {
  const { companies, updateCompany, deleteCompany, addCompany } = useCompany()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyForm | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2 | null>(null)

  useEffect(() => {
    if (!expandedId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        setExpandedId(null)
        setForm(null)
        setDeleteStep(null)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [expandedId])

  function toggleExpand(company: typeof companies[0]) {
    if (expandedId === company.id) {
      setExpandedId(null)
      setForm(null)
      setDeleteStep(null)
    } else {
      setExpandedId(company.id)
      setForm({
        id: company.id,
        name: company.name,
        location: company.location ?? '',
        color: company.color ?? '',
        logo: company.logo ?? '',
        logoThumb: company.logoThumb ?? '',
      })
      setSavedId(null)
      setDeleteStep(null)
    }
  }

  function updateForm(field: keyof Omit<CompanyForm, 'id'>, value: string) {
    if (!form) return
    setForm({ ...form, [field]: value })
    setSavedId(null)
  }

  async function handleSave() {
    if (!form) return
    try {
      await updateCompany(form.id, {
        name: form.name,
        location: form.location,
        color: form.color,
        logo: form.logo,
        logoThumb: form.logoThumb,
      })
      setSavedId(form.id)
      setTimeout(() => {
        setSavedId(null)
        setExpandedId(null)
        setForm(null)
      }, 1200)
    } catch (err) {
      console.error('Error saving company:', err)
    }
  }

  function handleDeleteCompany() {
    if (!form) return
    deleteCompany(form.id)
    setDeleteStep(null)
    setExpandedId(null)
    setForm(null)
  }


  return (
    <PageTransition>
      <PageHeader title="Compañías" />

      <div className="rounded-xl bg-surface card-elevated">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-10 border-r border-border"></th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-1/3 border-r border-border">Nombre</th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-1/3 border-r border-border">Ubicación</th>
              <th className="text-left text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-1/3 border-r border-border">Color</th>
              <th className="text-right text-caption uppercase tracking-wider text-mid-gray font-medium px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const isExpanded = expandedId === company.id
              return (
                <Fragment key={company.id}>
                  <tr
                    onClick={() => toggleExpand(company)}
                    className={cn(
                      'border-b border-border last:border-b-0 group cursor-pointer select-none transition-colors hover:bg-bone/30',
                      isExpanded && 'bg-bone/20'
                    )}
                  >
                    <td className="px-4 py-3 border-r border-border">
                      <ChevronRight
                        size={14}
                        strokeWidth={1.5}
                        className={cn('text-mid-gray transition-transform duration-200', isExpanded && 'rotate-90')}
                      />
                    </td>
                    <td className="px-4 py-3 border-r border-border">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo company={company} />
                        <span className="text-body font-medium text-dark-graphite truncate">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-r border-border">
                      {company.location ? (
                        <span className="flex items-center gap-1 text-body text-mid-gray">
                          <MapPin size={12} strokeWidth={1.5} />
                          {company.location}
                        </span>
                      ) : (
                        <span className="text-body text-mid-gray">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-border">
                      {company.color ? (
                        <div
                          className="w-6 h-6 rounded-md border border-border"
                          style={{ backgroundColor: company.color }}
                        />
                      ) : (
                        <span className="text-body text-mid-gray">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleExpand(company)}
                        className={cn(
                          'p-1.5 rounded-lg transition-all duration-150',
                          isExpanded
                            ? 'text-graphite bg-bone'
                            : 'text-mid-gray/40 group-hover:text-mid-gray hover:bg-bone'
                        )}
                      >
                        {isExpanded ? <X size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}
                      </button>
                    </td>
                  </tr>

                  {/* Inline edit panel */}
                  {isExpanded && form && (
                    <tr className="border-b border-border last:border-b-0 bg-bone/30">
                      <td className="border-r border-border" />
                      <td colSpan={4} className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={labelClass}>Nombre</label>
                            <input
                              value={form.name}
                              onChange={(e) => updateForm('name', e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
                              placeholder="Nombre"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Ubicación</label>
                            <input
                              value={form.location}
                              onChange={(e) => updateForm('location', e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
                              placeholder="Ej. Medellín, CO"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Color</label>
                            <div className="flex items-center gap-2.5">
                              <label
                                className="w-10 h-10 rounded-[10px] border border-input-border cursor-pointer shrink-0 transition-all hover:border-border-hover hover:shadow-sm"
                                style={{ backgroundColor: form.color || '#2D2D2D' }}
                              >
                                <input
                                  type="color"
                                  value={form.color || '#2D2D2D'}
                                  onChange={(e) => updateForm('color', e.target.value)}
                                  className="sr-only"
                                />
                              </label>
                              <input
                                value={form.color}
                                onChange={(e) => updateForm('color', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
                                placeholder="#2D2D2D"
                                className={inputClass}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>Logo</label>
                            <LogoPicker
                              value={form.logo}
                              companyId={form.id}
                              onChange={(url, thumb) => { setForm({ ...form, logo: url, logoThumb: thumb ?? '' }); setSavedId(null) }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
                          <button
                            type="button"
                            onClick={() => setDeleteStep(1)}
                            className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                            title="Eliminar compañía"
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                          </button>
                          <div className="flex items-center gap-3 ml-auto">
                            <button
                              type="button"
                              onClick={() => { setExpandedId(null); setForm(null); setDeleteStep(null) }}
                              className="px-4 py-2 rounded-[10px] text-body font-medium text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={!form.name.trim()}
                              className={cn(
                                'px-4 py-2 rounded-[10px] text-body font-medium transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5',
                                savedId === form.id
                                  ? 'bg-emerald-500 text-white scale-[1.02]'
                                  : 'btn-primary hover:-translate-y-px hover:shadow-md'
                              )}
                            >
                              {savedId === form.id ? (
                                <><Check size={14} strokeWidth={2.5} /> Guardado</>
                              ) : (
                                'Guardar'
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Delete confirmation */}
                        {deleteStep !== null && (
                          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            {deleteStep === 1 && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-body text-red-600">
                                  Eliminar <strong>{form.name || 'esta compañía'}</strong>?
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setDeleteStep(null)}
                                    className="px-3 py-1.5 rounded-lg text-caption font-medium text-mid-gray hover:bg-surface-elevated transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => setDeleteStep(2)}
                                    className="px-3 py-1.5 rounded-lg text-caption font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                  >
                                    Sí, eliminar
                                  </button>
                                </div>
                              </div>
                            )}
                            {deleteStep === 2 && (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-body text-red-700 font-medium">
                                  Esta acción es irreversible. Todos los datos se perderán.
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setDeleteStep(null)}
                                    className="px-3 py-1.5 rounded-lg text-caption font-medium text-mid-gray hover:bg-surface-elevated transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={handleDeleteCompany}
                                    className="px-3 py-1.5 rounded-lg text-caption font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                                  >
                                    Confirmar eliminación
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>

        {companies.length === 0 && (
          <div className="px-4 py-8 text-center text-body text-mid-gray">
            No hay compañías registradas
          </div>
        )}
      </div>

      {/* Add company button */}
      <button
        type="button"
        onClick={async () => {
          const newId = await addCompany()
          const newCompany = companies.find((c) => c.id === newId)
          if (newCompany) {
            toggleExpand(newCompany)
          } else {
            setExpandedId(newId)
            setForm({ id: newId, name: '', location: '', color: '', logo: '', logoThumb: '' })
          }
          setDeleteStep(null)
          setSavedId(null)
        }}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border text-body font-medium text-mid-gray hover:text-graphite hover:border-graphite hover:bg-bone/50 transition-all duration-200"
      >
        <Plus size={15} strokeWidth={2} />
        Agregar compañía
      </button>
    </PageTransition>
  )
}
