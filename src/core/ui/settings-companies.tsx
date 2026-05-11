import { useState, useEffect, Fragment } from 'react'
import { Plus, MapPin, Trash2, Check, ChevronRight, X, AlertCircle, Copy } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { cn } from '@/lib/utils'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { useCompany } from '@/core/hooks/use-company'
import { CompanyLogo } from '@/core/ui/company-logo'
import { LogoPicker } from '@/core/ui/logo-picker'
import { getAppFunctions } from '@/core/firebase/config'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface CompanyForm {
  id: string
  name: string
  location: string
  color: string
  logo: string
  logoThumb: string
  driveRootFolderId: string
}

type DriveValidationState =
  | { kind: 'idle' }
  | { kind: 'validating' }
  | { kind: 'valid'; folderName: string }
  | { kind: 'invalid'; error: string }

export function SettingsCompanies() {
  const { companies, updateCompany, deleteCompany, addCompany } = useCompany()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyForm | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [driveValidation, setDriveValidation] = useState<DriveValidationState>({ kind: 'idle' })
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)

  useEffect(() => {
    if (!expandedId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        setExpandedId(null)
        setForm(null)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [expandedId])

  function toggleExpand(company: typeof companies[0]) {
    if (expandedId === company.id) {
      setExpandedId(null)
      setForm(null)
      setConfirmDelete(false)
      setDriveValidation({ kind: 'idle' })
    } else {
      setExpandedId(company.id)
      setForm({
        id: company.id,
        name: company.name,
        location: company.location ?? '',
        color: company.color ?? '',
        logo: company.logo ?? '',
        logoThumb: company.logoThumb ?? '',
        driveRootFolderId: company.driveRootFolderId ?? '',
      })
      setSavedId(null)
      setConfirmDelete(false)
      setDriveValidation({ kind: 'idle' })
      // Fetch SA email lazy una sola vez (sirve para todas las empresas).
      if (!serviceAccountEmail) {
        void (async () => {
          try {
            const fns = await getAppFunctions()
            const fn = httpsCallable<unknown, { email: string | null }>(fns, 'getDriveServiceAccount')
            const res = await fn({})
            if (res.data?.email) setServiceAccountEmail(res.data.email)
          } catch {
            /* noop — el campo de email es informativo */
          }
        })()
      }
    }
  }

  async function handleValidateDrive() {
    if (!form?.driveRootFolderId.trim()) {
      setDriveValidation({ kind: 'invalid', error: 'Ingresa un Folder ID' })
      return
    }
    setDriveValidation({ kind: 'validating' })
    try {
      const fns = await getAppFunctions()
      const fn = httpsCallable<
        { companyId: string; rootFolderId: string },
        { ok: boolean; folderName?: string; error?: string; serviceAccountEmail?: string | null }
      >(fns, 'validateDriveFolder')
      const res = await fn({ companyId: form.id, rootFolderId: form.driveRootFolderId.trim() })
      if (res.data.serviceAccountEmail) setServiceAccountEmail(res.data.serviceAccountEmail)
      if (res.data.ok && res.data.folderName) {
        setDriveValidation({ kind: 'valid', folderName: res.data.folderName })
      } else {
        setDriveValidation({ kind: 'invalid', error: res.data.error ?? 'No se pudo validar' })
      }
    } catch (err) {
      setDriveValidation({ kind: 'invalid', error: (err as Error).message ?? 'Error de red' })
    }
  }

  async function copyEmail() {
    if (!serviceAccountEmail) return
    try {
      await navigator.clipboard.writeText(serviceAccountEmail)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 1500)
    } catch {
      /* noop */
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
        driveRootFolderId: form.driveRootFolderId.trim() || undefined,
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

  async function handleDeleteCompany() {
    if (!form) return
    await deleteCompany(form.id)
    setConfirmDelete(false)
    setExpandedId(null)
    setForm(null)
  }


  return (
    <PageTransition>
      <PageHeader title="Compañías" />

      <div className="rounded-xl bg-surface card-elevated overflow-x-auto">
        <table className="w-full table-fixed min-w-[600px]">
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
                        <CompanyLogo company={company} size="md" />
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                className="w-10 h-10 rounded-lg border border-input-border cursor-pointer shrink-0 transition-all hover:border-border-hover hover:shadow-sm"
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

                        {/* Drive integration */}
                        <div className="mt-5 pt-4 border-t border-border space-y-3">
                          <div>
                            <div className="text-caption uppercase tracking-wider text-mid-gray mb-1">Drive — carpeta raíz</div>
                            <p className="text-caption text-mid-gray mb-2">
                              Crea una carpeta en tu Google Drive, compártela como editor con la cuenta de servicio, y pega el ID aquí. Los archivos de Facturas, Pagos y Compras se organizarán automáticamente por año y mes.
                            </p>
                            {serviceAccountEmail && (
                              <div className="flex items-center gap-2 mb-2 text-caption text-mid-gray">
                                <span>Cuenta de servicio:</span>
                                <code className="px-2 py-0.5 rounded bg-bone border border-border/60 text-graphite">
                                  {serviceAccountEmail}
                                </code>
                                <button
                                  type="button"
                                  onClick={copyEmail}
                                  className="p-1 rounded hover:bg-bone transition-colors text-mid-gray hover:text-graphite"
                                  title="Copiar email"
                                >
                                  {emailCopied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={1.5} />}
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <input
                                value={form.driveRootFolderId}
                                onChange={(e) => { setForm({ ...form, driveRootFolderId: e.target.value }); setDriveValidation({ kind: 'idle' }); setSavedId(null) }}
                                placeholder="Folder ID de Drive (ej: 1A2bCdEf...)"
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={handleValidateDrive}
                                disabled={driveValidation.kind === 'validating' || !form.driveRootFolderId.trim()}
                                className="px-3 py-2 rounded-lg text-body font-medium text-graphite bg-bone border border-border/60 hover:bg-bone/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                              >
                                {driveValidation.kind === 'validating' ? 'Validando…' : 'Validar'}
                              </button>
                            </div>
                            {driveValidation.kind === 'valid' && (
                              <div className="flex items-center gap-1.5 mt-2 text-caption text-positive">
                                <Check size={12} strokeWidth={2} />
                                Carpeta "{driveValidation.folderName}" accesible
                              </div>
                            )}
                            {driveValidation.kind === 'invalid' && (
                              <div className="flex items-center gap-1.5 mt-2 text-caption text-destructive">
                                <AlertCircle size={12} strokeWidth={2} />
                                {driveValidation.error}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
                          <HoverHint label="Eliminar compañía">
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(true)}
                              className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                            >
                              <Trash2 size={15} strokeWidth={1.5} />
                            </button>
                          </HoverHint>
                          <div className="flex items-center gap-3 ml-auto">
                            <button
                              type="button"
                              onClick={() => { setExpandedId(null); setForm(null); setConfirmDelete(false) }}
                              className="px-4 py-2 rounded-lg text-body font-medium text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={!form.name.trim()}
                              className={cn(
                                'px-4 py-2 rounded-lg text-body font-medium transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5',
                                savedId === form.id
                                  ? 'bg-emerald-500 text-white scale-[1.02]'
                                  : 'btn-primary'
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
            setForm({ id: newId, name: '', location: '', color: '', logo: '', logoThumb: '', driveRootFolderId: '' })
          }
          setConfirmDelete(false)
          setSavedId(null)
        }}
        className="mt-4 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border text-body font-medium text-mid-gray hover:text-graphite hover:border-graphite hover:bg-bone/50 transition-all duration-200"
      >
        <Plus size={15} strokeWidth={2} />
        Agregar compañía
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar compañía"
        description={`¿Estás seguro de que deseas eliminar "${form?.name || 'esta compañía'}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteCompany}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageTransition>
  )
}
