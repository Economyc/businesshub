import { useState, useEffect, useRef } from 'react'
import { X, Plus, MapPin, Trash2, ChevronDown, Check, Upload, ImageIcon } from 'lucide-react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { cn } from '@/lib/utils'
import { getAppStorage } from '@/core/firebase/config'
import { PageTransition } from '@/core/ui/page-transition'
import { PageHeader } from '@/core/ui/page-header'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import { HoverHint } from '@/components/ui/tooltip'
import { useCompany } from '@/core/hooks/use-company'
import { useSettings } from '@/core/hooks/use-settings'
import { CompanyLogo } from '@/core/ui/company-logo'

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'
const labelClass = 'block text-caption uppercase tracking-wider text-mid-gray mb-1'

interface CompanyForm {
  id: string
  name: string
  location: string
  color: string
  logo: string
}

export function SettingsPage() {
  const { companies, updateCompany, deleteCompany, addCompany } = useCompany()
  const { categories, addCategory, removeCategory } = useSettings()

  // --- Company editing ---
  const [forms, setForms] = useState<CompanyForm[]>([])
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const mapped = companies.map((c) => ({
      id: c.id,
      name: c.name,
      location: c.location ?? '',
      color: c.color ?? '',
      logo: c.logo ?? '',
    }))
    setForms(mapped)
    if (!selectedFormId && mapped.length > 0) setSelectedFormId(mapped[0].id)
    if (selectedFormId && !mapped.find((f) => f.id === selectedFormId) && mapped.length > 0) {
      setSelectedFormId(mapped[0].id)
    }
  }, [companies, selectedFormId])

  const activeForm = forms.find((f) => f.id === selectedFormId) ?? null

  function updateForm(field: keyof Omit<CompanyForm, 'id'>, value: string) {
    if (!selectedFormId) return
    setForms((prev) =>
      prev.map((f) => (f.id === selectedFormId ? { ...f, [field]: value } : f))
    )
    setSavedId(null)
  }

  async function handleSave() {
    if (!activeForm) return
    try {
      await updateCompany(activeForm.id, {
        name: activeForm.name,
        location: activeForm.location,
        color: activeForm.color,
        logo: activeForm.logo,
      })
      setSavedId(activeForm.id)
      setTimeout(() => setSavedId(null), 2000)
    } catch (err) {
      console.error('Error saving company:', err)
    }
  }

  async function handleDeleteCompany() {
    if (!activeForm) return
    await deleteCompany(activeForm.id)
    setConfirmDeleteCompany(false)
  }

  function handleSelectCompany(id: string) {
    setSelectedFormId(id)
    setPickerOpen(false)
    setSavedId(null)
    setConfirmDeleteCompany(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeForm) return
    setUploading(true)
    try {
      const storage = await getAppStorage()
      const fileRef = storageRef(storage, `logos/${activeForm.id}/${file.name}`)
      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)
      setForms((prev) =>
        prev.map((f) => (f.id === activeForm.id ? { ...f, logo: url } : f))
      )
      setSavedId(null)
    } catch (err) {
      console.error('Error uploading logo:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleRemoveLogo() {
    if (!activeForm) return
    setForms((prev) =>
      prev.map((f) => (f.id === activeForm.id ? { ...f, logo: '' } : f))
    )
    setSavedId(null)
  }

  // --- Categories ---
  const [newCategory, setNewCategory] = useState('')
  const [deleteCatTarget, setDeleteCatTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!pickerOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault()
        setPickerOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => document.removeEventListener('keydown', handleKey, true)
  }, [pickerOpen])

  function handleAddCategory() {
    const trimmed = newCategory.trim()
    if (!trimmed || categories.some((c) => c.name === trimmed)) return
    addCategory(trimmed, '#95A5A6')
    setNewCategory('')
  }

  function handleCategoryKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCategory()
    }
  }

  function handleDeleteCategory() {
    if (!deleteCatTarget) return
    removeCategory(deleteCatTarget.id)
    setDeleteCatTarget(null)
  }

  return (
    <PageTransition>
      <PageHeader title="Configuración" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
      {/* Sección 1: Compañías */}
      <section className="flex flex-col">
        <h2 className="text-subheading font-medium text-dark-graphite mb-4">Compañías</h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          {/* Company picker */}
          <div className="relative mb-4">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body transition-all duration-200 hover:border-border-hover"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CompanyLogo company={activeForm} />
                <div className="min-w-0 text-left">
                  <div className="text-body font-medium text-dark-graphite truncate">
                    {activeForm?.name || 'Seleccionar compañía'}
                  </div>
                  {activeForm?.location && (
                    <div className="flex items-center gap-0.5 text-[11px] text-mid-gray truncate">
                      <MapPin size={9} />
                      {activeForm.location}
                    </div>
                  )}
                </div>
              </div>
              <ChevronDown size={14} className={cn('text-mid-gray shrink-0 transition-transform', pickerOpen && 'rotate-180')} />
            </button>

            {pickerOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-lg z-50 py-1.5 overflow-hidden">
                {forms.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectCompany(f.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
                      selectedFormId === f.id ? 'bg-bone' : 'hover:bg-bone/50'
                    )}
                  >
                    <CompanyLogo company={f} />
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-dark-graphite truncate">{f.name || 'Sin nombre'}</div>
                      {f.location && (
                        <div className="flex items-center gap-0.5 text-[11px] text-mid-gray truncate">
                          <MapPin size={9} />
                          {f.location}
                        </div>
                      )}
                    </div>
                    {selectedFormId === f.id && <Check size={14} className="text-graphite shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Edit form for selected company */}
          {activeForm && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input
                    value={activeForm.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    placeholder="Nombre"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Ubicación</label>
                  <input
                    value={activeForm.location}
                    onChange={(e) => updateForm('location', e.target.value)}
                    placeholder="Ej. CDMX, MX"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Color</label>
                    <div className="flex items-center gap-2.5">
                      <label
                        className="w-10 h-10 rounded-lg border border-input-border cursor-pointer shrink-0 transition-all hover:border-border-hover hover:shadow-sm"
                        style={{ backgroundColor: activeForm.color || '#2D2D2D' }}
                      >
                        <input
                          type="color"
                          value={activeForm.color || '#2D2D2D'}
                          onChange={(e) => updateForm('color', e.target.value)}
                          className="sr-only"
                        />
                      </label>
                      <input
                        value={activeForm.color}
                        onChange={(e) => updateForm('color', e.target.value)}
                        placeholder="#2D2D2D"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Logo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg border border-input-border bg-bone/30 flex items-center justify-center overflow-hidden shrink-0">
                        {activeForm.logo ? (
                          <img src={activeForm.logo} alt="Logo" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={18} strokeWidth={1.5} className="text-mid-gray/40" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input-border text-caption font-medium text-graphite hover:bg-bone transition-colors disabled:opacity-50"
                        >
                          <Upload size={13} strokeWidth={1.5} />
                          {uploading ? 'Subiendo...' : 'Subir'}
                        </button>
                        {activeForm.logo && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-[11px] text-mid-gray hover:text-red-500 transition-colors text-left"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                <HoverHint label="Eliminar compañía">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCompany(true)}
                    className="p-2 rounded-lg text-mid-gray hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                </HoverHint>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!activeForm.name.trim()}
                    className={cn(
                      'px-4 py-2 rounded-lg text-body font-medium transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5',
                      savedId === activeForm.id
                        ? 'bg-emerald-500 text-white scale-[1.02]'
                        : 'btn-primary'
                    )}
                  >
                    {savedId === activeForm.id ? (
                      <><Check size={14} strokeWidth={2.5} /> Guardado</>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={async () => {
              const newId = await addCompany()
              setSelectedFormId(newId)
              setConfirmDeleteCompany(false)
              setSavedId(null)
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border text-body font-medium text-mid-gray hover:text-graphite hover:border-graphite hover:bg-bone/50 transition-all duration-200"
          >
            <Plus size={15} strokeWidth={2} />
            Agregar compañía
          </button>
        </div>
      </section>

      {/* Sección 2: Categorías Financieras */}
      <section className="flex flex-col">
        <h2 className="text-subheading font-medium text-dark-graphite mb-4">Categorías Financieras</h2>

        <div className="bg-surface rounded-xl card-elevated p-4 flex flex-col flex-1">
          {categories.length === 0 ? (
            <p className="text-body text-mid-gray text-center py-4 flex-1 flex items-center justify-center">No hay categorías</p>
          ) : (
            <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bone/50 transition-colors group">
                  <span className="text-body text-graphite">{cat.name}</span>
                  <button
                    onClick={() => setDeleteCatTarget({ id: cat.id, name: cat.name })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-mid-gray hover:text-negative-text transition-all"
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={handleCategoryKeyDown}
              placeholder="Nueva categoría..."
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={!newCategory.trim()}
              className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>
      </div>

      <ConfirmDialog
        open={confirmDeleteCompany}
        title="Eliminar compañía"
        description={`¿Estás seguro de que deseas eliminar "${activeForm?.name || 'esta compañía'}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteCompany}
        onCancel={() => setConfirmDeleteCompany(false)}
      />

      <ConfirmDialog
        open={deleteCatTarget !== null}
        title="Eliminar categoría"
        description={`¿Estás seguro de que deseas eliminar la categoría "${deleteCatTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCatTarget(null)}
      />
    </PageTransition>
  )
}
