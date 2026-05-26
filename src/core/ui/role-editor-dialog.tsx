import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Trash2,
  X,
  Lock,
  Loader2,
  Search,
  Building2,
  ListChecks,
  LayoutGrid,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { ACCESS_REGISTRY } from '@/core/config/access-registry'
import { CompanyLogo } from '@/core/ui/company-logo'
import { ConfirmDialog } from '@/core/ui/confirm-dialog'
import type { Company } from '@/core/types'
import type { PermissionAction, RoleDefinition, RolePermissions } from '@/core/types/permissions'

const ALL_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']
const ACTION_LABELS: Record<PermissionAction, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
}
const ROLE_COLORS = ['#1a1a2e', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6b7280', '#ec4899']

type TabKey = 'general' | 'companies' | 'pages' | 'tabs'

const TABS: { key: TabKey; label: string; Icon: typeof Shield }[] = [
  { key: 'general', label: 'General', Icon: SlidersHorizontal },
  { key: 'companies', label: 'Empresas', Icon: Building2 },
  { key: 'pages', label: 'Páginas', Icon: LayoutGrid },
  { key: 'tabs', label: 'Tabs', Icon: ListChecks },
]

function emptyPerms(): RolePermissions {
  return { pages: {}, tabs: {} }
}

function clonePerms(p: RolePermissions): RolePermissions {
  return {
    pages: Object.fromEntries(Object.entries(p.pages ?? {}).map(([k, v]) => [k, [...v]])),
    tabs: { ...(p.tabs ?? {}) },
  }
}

interface Props {
  role: RoleDefinition
  /** Lista RAW de companies (sin filtrar) — el owner debe ver todas para asignar. */
  companies: Company[]
  open: boolean
  onClose: () => void
  onSave: (updated: RoleDefinition) => Promise<void>
  onDelete?: () => void
}

export function RoleEditorDialog({ role, companies, open, onClose, onSave, onDelete }: Props) {
  const isOwnerRole = role.id === 'owner'

  const [draft, setDraft] = useState<RoleDefinition>(() => ({
    ...role,
    permissions: clonePerms(role.permissions ?? emptyPerms()),
    allowedCompanyIds:
      role.allowedCompanyIds === undefined ? undefined : [...role.allowedCompanyIds],
  }))
  const [tab, setTab] = useState<TabKey>('general')
  const [companySearch, setCompanySearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)

  // Reset del draft cuando cambia el rol seleccionado. Más limpio que setState
  // durante render: React monta el componente con el state base y luego este
  // efecto lo iguala al rol nuevo (sin doble render visible al usuario).
  useEffect(() => {
    setDraft({
      ...role,
      permissions: clonePerms(role.permissions ?? emptyPerms()),
      allowedCompanyIds:
        role.allowedCompanyIds === undefined ? undefined : [...role.allowedCompanyIds],
    })
    setTab('general')
    setCompanySearch('')
  }, [role.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const original = useMemo(
    () => ({
      ...role,
      permissions: role.permissions ?? emptyPerms(),
      allowedCompanyIds: role.allowedCompanyIds,
    }),
    [role],
  )
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(original)

  function setAction(pageId: string, action: PermissionAction, on: boolean) {
    if (isOwnerRole) return
    setDraft((prev) => {
      const current = new Set(prev.permissions.pages[pageId] ?? [])
      if (on) {
        current.add(action)
        // No se puede crear/editar/eliminar sin poder ver.
        if (action !== 'read') current.add('read')
      } else {
        current.delete(action)
        // Sin "ver" no hay acceso: se vacía la página.
        if (action === 'read') current.clear()
      }
      const next = ALL_ACTIONS.filter((a) => current.has(a))
      const pages = { ...prev.permissions.pages }
      if (next.length === 0) delete pages[pageId]
      else pages[pageId] = next
      return { ...prev, permissions: { ...prev.permissions, pages } }
    })
  }

  function setTabPerm(tabId: string, on: boolean) {
    if (isOwnerRole) return
    setDraft((prev) => {
      const tabs = { ...prev.permissions.tabs }
      if (on) tabs[tabId] = true
      else delete tabs[tabId]
      return { ...prev, permissions: { ...prev.permissions, tabs } }
    })
  }

  function toggleAllCompanies(on: boolean) {
    if (isOwnerRole) return
    // ON = sin restricción (undefined). OFF = lista vacía → bloquea todo
    // hasta que el owner elija al menos una.
    setDraft((prev) => ({
      ...prev,
      allowedCompanyIds: on ? undefined : [],
    }))
  }

  function toggleCompany(companyId: string) {
    if (isOwnerRole) return
    setDraft((prev) => {
      const current = prev.allowedCompanyIds ?? []
      const next = current.includes(companyId)
        ? current.filter((id) => id !== companyId)
        : [...current, companyId]
      return { ...prev, allowedCompanyIds: next }
    })
  }

  const allCompaniesAllowed = draft.allowedCompanyIds === undefined
  const selectedCompanyIds = new Set(draft.allowedCompanyIds ?? [])

  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q),
    )
  }, [companies, companySearch])

  // Validación de "destinos vacíos": si el owner apagó "Acceso a todas" pero
  // no seleccionó ninguna empresa, el rol nace sin posibilidad de entrar a
  // ninguna. Bloqueamos el guardado para evitar el footgun silencioso.
  const noTargets = !allCompaniesAllowed && (draft.allowedCompanyIds ?? []).length === 0

  async function handleSave() {
    if (noTargets) return
    setSaving(true)
    try {
      // Preservamos los flags existentes — el editor no los expone para no
      // sorprender al owner degradándolos sin querer. Si en el futuro queremos
      // toggles independientes en General, se agregan ahí.
      await onSave({ ...draft })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setDraft({
      ...role,
      permissions: clonePerms(role.permissions ?? emptyPerms()),
      allowedCompanyIds:
        role.allowedCompanyIds === undefined ? undefined : [...role.allowedCompanyIds],
    })
  }

  function handleAttemptClose() {
    if (hasChanges && !isOwnerRole) {
      setConfirmingClose(true)
      return
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleAttemptClose}
            className="fixed inset-0 bg-black/40 z-50"
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={`Editar rol ${role.label}`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'w-[min(1100px,calc(100vw-2rem))] max-h-[min(820px,calc(100vh-2rem))]',
              'bg-surface-elevated card-elevated rounded-2xl overflow-hidden',
              'flex flex-col',
            )}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: draft.color + '20' }}
              >
                <Shield size={18} style={{ color: draft.color }} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                {isOwnerRole ? (
                  <>
                    <h2 className="text-heading font-medium text-dark-graphite truncate">{draft.label}</h2>
                    <p className="text-caption text-mid-gray truncate">{draft.description}</p>
                  </>
                ) : (
                  <>
                    <input
                      value={draft.label}
                      onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Nombre del rol"
                      className="text-heading font-medium text-dark-graphite bg-transparent outline-none w-full border-b border-transparent focus:border-input-focus transition-colors"
                    />
                    <input
                      value={draft.description}
                      onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descripción"
                      className="text-caption text-mid-gray bg-transparent outline-none w-full border-b border-transparent focus:border-input-focus transition-colors mt-1"
                    />
                  </>
                )}
              </div>
              <button
                onClick={handleAttemptClose}
                className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-4 border-b border-border flex items-center gap-1 overflow-x-auto">
              {TABS.map(({ key, label, Icon }) => {
                const active = tab === key
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 text-body transition-colors relative',
                      active
                        ? 'text-dark-graphite font-medium'
                        : 'text-mid-gray hover:text-graphite',
                    )}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    {label}
                    {active && (
                      <span aria-hidden className="absolute left-2 right-2 -bottom-px h-0.5 bg-graphite rounded-full" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isOwnerRole && (
                <div className="flex items-center gap-2 rounded-lg bg-bone px-3 py-2.5 text-caption text-mid-gray mb-5">
                  <Lock size={13} strokeWidth={1.5} />
                  El Propietario tiene acceso total a todo (incluido lo que se agregue). No editable.
                </div>
              )}

              {tab === 'general' && (
                <div className="space-y-6 max-w-2xl">
                  {!isOwnerRole && (
                    <div>
                      <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-2">Color</h4>
                      <div className="flex gap-2 flex-wrap">
                        {ROLE_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setDraft((p) => ({ ...p, color: c }))}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all',
                              draft.color === c && 'ring-2 ring-offset-2 ring-graphite',
                            )}
                            style={{ backgroundColor: c }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-border/60 divide-y divide-border/40">
                    <div className="px-4 py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-body text-dark-graphite font-medium">Tipo</div>
                        <div className="text-caption text-mid-gray">
                          {draft.isSystem ? 'Rol del sistema (no se puede eliminar)' : 'Rol personalizado'}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-body text-dark-graphite font-medium">ID del rol</div>
                        <div className="text-caption text-mid-gray font-mono">{draft.id}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'companies' && (
                <div className="space-y-4 max-w-3xl">
                  {isOwnerRole ? (
                    <div className="rounded-xl bg-bone/60 border border-border/60 px-4 py-3 text-body text-mid-gray">
                      El Propietario tiene acceso a todas las empresas, presentes y futuras.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-body font-medium text-dark-graphite">Acceso a todas las empresas</div>
                          <div className="text-caption text-mid-gray">
                            Si está activado, este rol entra a cualquier empresa presente y futura.
                          </div>
                        </div>
                        <Switch
                          checked={allCompaniesAllowed}
                          onCheckedChange={toggleAllCompanies}
                          aria-label="Acceso a todas las empresas"
                        />
                      </div>

                      {!allCompaniesAllowed && (
                        <>
                          <div className="relative">
                            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-mid-gray" />
                            <input
                              value={companySearch}
                              onChange={(e) => setCompanySearch(e.target.value)}
                              placeholder="Buscar empresa…"
                              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input-border bg-surface text-body text-dark-graphite placeholder:text-mid-gray outline-none focus:border-input-focus transition-colors"
                            />
                          </div>

                          <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                            {filteredCompanies.length === 0 ? (
                              <div className="px-4 py-6 text-center text-caption text-mid-gray">
                                Sin resultados.
                              </div>
                            ) : (
                              filteredCompanies.map((c) => {
                                const checked = selectedCompanyIds.has(c.id)
                                return (
                                  <label
                                    key={c.id}
                                    className={cn(
                                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                                      checked ? 'bg-bone/60' : 'hover:bg-bone/30',
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleCompany(c.id)}
                                      className="w-4 h-4 accent-graphite cursor-pointer"
                                    />
                                    <CompanyLogo company={c} size="sm" />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-body text-dark-graphite truncate">{c.name}</div>
                                      {c.location && (
                                        <div className="text-caption text-mid-gray truncate">{c.location}</div>
                                      )}
                                    </div>
                                  </label>
                                )
                              })
                            )}
                          </div>

                          <div
                            className={cn(
                              'flex items-start gap-2 rounded-lg px-3 py-2 text-caption',
                              selectedCompanyIds.size === 0
                                ? 'bg-negative-bg text-negative-text'
                                : 'text-mid-gray',
                            )}
                          >
                            {selectedCompanyIds.size === 0 ? (
                              <>
                                <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                                <span>
                                  Sin empresas seleccionadas: nadie con este rol podrá entrar a ninguna empresa.
                                  Activa "Acceso a todas" o elige al menos una para poder guardar.
                                </span>
                              </>
                            ) : (
                              <span>
                                {selectedCompanyIds.size} {selectedCompanyIds.size === 1 ? 'empresa permitida' : 'empresas permitidas'}.
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === 'pages' && (
                <div className="space-y-6">
                  {ACCESS_REGISTRY.map((mod) => {
                    const pages = mod.pages.filter((p) => !p.matrixHidden)
                    if (pages.length === 0) return null
                    return (
                      <div key={mod.id}>
                        <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-3">
                          {mod.label}
                        </h4>
                        <div className="rounded-xl bg-bone/40 border border-border/60 overflow-hidden divide-y divide-border/40">
                          {pages.map((page) => {
                            const granted = isOwnerRole
                              ? page.actions
                              : draft.permissions.pages[page.id] ?? []
                            return (
                              <div key={page.id} className="px-4 py-3 flex items-center justify-between gap-4">
                                <div className="text-body font-medium text-dark-graphite">{page.label}</div>
                                <div className="flex items-center gap-3 flex-wrap justify-end">
                                  {page.actions.map((action) => (
                                    <label key={action} className="flex items-center gap-1.5">
                                      <Switch
                                        size="sm"
                                        checked={isOwnerRole ? true : granted.includes(action)}
                                        onCheckedChange={(on) => setAction(page.id, action, on)}
                                        disabled={isOwnerRole}
                                        aria-label={`${page.label} ${ACTION_LABELS[action]}`}
                                      />
                                      <span className="text-caption text-mid-gray">{ACTION_LABELS[action]}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'tabs' && (
                <div className="space-y-6">
                  {ACCESS_REGISTRY.map((mod) => {
                    const pages = mod.pages.filter((p) => p.tabs && p.tabs.length > 0)
                    if (pages.length === 0) return null
                    return (
                      <div key={mod.id}>
                        <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-3">
                          {mod.label}
                        </h4>
                        <div className="rounded-xl bg-bone/40 border border-border/60 overflow-hidden divide-y divide-border/40">
                          {pages.map((page) => (
                            <div key={page.id} className="px-4 py-3 space-y-2">
                              <div className="text-body font-medium text-dark-graphite">{page.label}</div>
                              <div className="flex flex-col gap-2 pl-3 border-l border-border/60">
                                {page.tabs!.map((t) => (
                                  <label key={t.id} className="flex items-center justify-between gap-3">
                                    <span className="text-caption text-graphite">{t.label}</span>
                                    <Switch
                                      size="sm"
                                      checked={isOwnerRole ? true : draft.permissions.tabs[t.id] === true}
                                      onCheckedChange={(on) => setTabPerm(t.id, on)}
                                      disabled={isOwnerRole}
                                      aria-label={`Tab ${t.label}`}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {!ACCESS_REGISTRY.some((m) => m.pages.some((p) => p.tabs && p.tabs.length > 0)) && (
                    <div className="text-caption text-mid-gray">No hay tabs configurables todavía.</div>
                  )}
                </div>
              )}

              {/* Acciones destructivas: solo para rol custom */}
              {tab === 'general' && onDelete && !role.isSystem && (
                <div className="mt-8 pt-5 border-t border-border max-w-2xl">
                  <h4 className="text-caption uppercase tracking-wider font-semibold text-mid-gray mb-2">Zona peligrosa</h4>
                  <button
                    onClick={onDelete}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-body font-medium text-negative-text border border-border/60 hover:bg-negative-bg transition-all"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                    Eliminar rol
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-4 bg-bone/30">
              <span className="text-caption text-mid-gray">
                {isOwnerRole
                  ? 'Solo lectura'
                  : hasChanges
                  ? 'Cambios sin guardar'
                  : 'Sin cambios'}
              </span>
              <div className="flex items-center gap-2">
                {!isOwnerRole && hasChanges && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all"
                  >
                    Descartar
                  </button>
                )}
                <button
                  onClick={handleAttemptClose}
                  className="px-3 py-1.5 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all"
                >
                  Cancelar
                </button>
                {!isOwnerRole && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !draft.label.trim() || !hasChanges || noTargets}
                    title={noTargets ? 'Selecciona al menos una empresa o activa "Acceso a todas".' : undefined}
                    className="px-4 py-1.5 rounded-lg text-body font-medium btn-primary transition-all disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <ConfirmDialog
            open={confirmingClose}
            title="Descartar cambios"
            description="Tienes cambios sin guardar en este rol. Si cierras ahora se perderán."
            confirmLabel="Descartar"
            onConfirm={() => {
              setConfirmingClose(false)
              onClose()
            }}
            onCancel={() => setConfirmingClose(false)}
          />
        </>
      )}
    </AnimatePresence>
  )
}
