import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/core/hooks/use-auth'
import { useCompany } from '@/core/hooks/use-company'
import { cn } from '@/lib/utils'
import {
  DEFAULT_USER_AGENT_MEMORY,
  getUserMemory,
  updateUserMemory,
} from '../services'
import type {
  AgentLanguage,
  AgentResponseFormat,
  UserAgentMemory,
} from '../types'

const NOTES_LIMIT = 500

interface AgentPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ToastSpec {
  id: string
  text: string
}

interface ShortcutEntry {
  id: string
  key: string
  value: string
}

function entriesFromShortcuts(map: Record<string, string>): ShortcutEntry[] {
  return Object.entries(map).map(([key, value], i) => ({
    id: `${i}-${key}`,
    key,
    value,
  }))
}

function shortcutsFromEntries(entries: ShortcutEntry[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of entries) {
    const key = e.key.trim()
    const value = e.value.trim()
    if (!key || !value) continue
    out[key] = value
  }
  return out
}

export function AgentPreferencesDialog({ open, onOpenChange }: AgentPreferencesDialogProps) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const { companies } = useCompany()
  const queryClient = useQueryClient()

  const [language, setLanguage] = useState<AgentLanguage>('es')
  const [preferredFormat, setPreferredFormat] = useState<AgentResponseFormat>('auto')
  const [preferredCompanies, setPreferredCompanies] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [shortcuts, setShortcuts] = useState<ShortcutEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastSpec | null>(null)

  // Carga la memoria al abrir el dialog. Si no existe, usa defaults.
  useEffect(() => {
    if (!open || !uid) return
    let cancelled = false
    setLoading(true)
    getUserMemory(uid)
      .then((mem) => {
        if (cancelled) return
        const data: UserAgentMemory = mem ?? DEFAULT_USER_AGENT_MEMORY
        setLanguage(data.language)
        setPreferredFormat(data.preferredFormat)
        setPreferredCompanies(data.preferredCompanies ?? [])
        setNotes(data.notes ?? '')
        setShortcuts(entriesFromShortcuts(data.shortcuts ?? {}))
      })
      .catch((err) => {
        console.error('Error cargando memoria del agente:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, uid])

  const notesRemaining = useMemo(() => NOTES_LIMIT - notes.length, [notes])

  function toggleCompany(id: string) {
    setPreferredCompanies((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  function addShortcut() {
    setShortcuts((prev) => [
      ...prev,
      { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, key: '', value: '' },
    ])
  }

  function removeShortcut(id: string) {
    setShortcuts((prev) => prev.filter((s) => s.id !== id))
  }

  function updateShortcut(id: string, field: 'key' | 'value', val: string) {
    setShortcuts((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)))
  }

  async function handleSave() {
    if (!uid || saving) return
    setSaving(true)
    try {
      const trimmedNotes = notes.slice(0, NOTES_LIMIT)
      await updateUserMemory(uid, {
        language,
        preferredFormat,
        preferredCompanies,
        notes: trimmedNotes,
        shortcuts: shortcutsFromEntries(shortcuts),
      })
      await queryClient.invalidateQueries({ queryKey: ['userMemory', uid] })
      setToast({ id: `t-${Date.now()}`, text: 'Preferencias guardadas' })
      setTimeout(() => setToast(null), 2200)
      onOpenChange(false)
    } catch (err) {
      console.error('Error guardando preferencias del agente:', err)
      setToast({ id: `t-${Date.now()}`, text: 'No se pudo guardar. Intenta de nuevo.' })
      setTimeout(() => setToast(null), 2800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-subheading text-dark-graphite">
              Preferencias del asistente
            </DialogTitle>
            <DialogDescription className="text-caption text-mid-gray">
              El asistente usará estas preferencias en cada conversación.
            </DialogDescription>
          </DialogHeader>

          {!uid ? (
            <p className="text-body text-mid-gray py-4">
              Inicia sesión para configurar las preferencias.
            </p>
          ) : loading ? (
            <p className="text-body text-mid-gray py-4">Cargando…</p>
          ) : (
            <div className="space-y-6">
              {/* Idioma */}
              <div className="space-y-2">
                <label className="text-body text-dark-graphite font-medium">Idioma</label>
                <p className="text-caption text-mid-gray">
                  Idioma en que el asistente te responderá por defecto.
                </p>
                <Select
                  value={language}
                  onValueChange={(v: unknown) => setLanguage((v as AgentLanguage) ?? 'es')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    sideOffset={4}
                    align="center"
                    alignOffset={0}
                    alignItemWithTrigger
                  >
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Formato preferido */}
              <div className="space-y-2">
                <label className="text-body text-dark-graphite font-medium">
                  Formato preferido
                </label>
                <p className="text-caption text-mid-gray">
                  Cómo prefieres que estructure las respuestas.
                </p>
                <Select
                  value={preferredFormat}
                  onValueChange={(v: unknown) =>
                    setPreferredFormat((v as AgentResponseFormat) ?? 'auto')
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    sideOffset={4}
                    align="center"
                    alignOffset={0}
                    alignItemWithTrigger
                  >
                    <SelectItem value="auto">Auto (el que mejor calce)</SelectItem>
                    <SelectItem value="table">Tablas cuando aplique</SelectItem>
                    <SelectItem value="prose">Prosa narrativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Locales prioritarios */}
              <div className="space-y-2">
                <label className="text-body text-dark-graphite font-medium">
                  Locales prioritarios
                </label>
                <p className="text-caption text-mid-gray">
                  Selecciona los locales que el asistente debe priorizar al analizar datos.
                </p>
                <div className="space-y-2">
                  {companies.length === 0 ? (
                    <p className="text-caption text-mid-gray">No hay locales configurados.</p>
                  ) : (
                    companies.map((c) => {
                      const checked = preferredCompanies.includes(c.id)
                      const label = c.location ? `${c.name} (${c.location})` : c.name
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            'flex items-center gap-2 px-2 py-2 rounded-lg border border-border/60 cursor-pointer hover:bg-bone transition-colors',
                            checked && 'bg-bone',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCompany(c.id)}
                            className="size-4 rounded-sm accent-graphite"
                          />
                          <span className="text-body text-graphite">{label}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <label className="text-body text-dark-graphite font-medium">Notas</label>
                <p className="text-caption text-mid-gray">
                  Cualquier contexto que quieras que el asistente recuerde siempre.
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, NOTES_LIMIT))}
                  rows={4}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                  placeholder="Ej: Soy chef y dueño. Prefiero respuestas directas."
                />
                <p className="text-caption text-mid-gray text-right">
                  {notesRemaining} caracteres restantes
                </p>
              </div>

              {/* Atajos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-body text-dark-graphite font-medium">
                    Atajos personales
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addShortcut}
                    className="text-graphite"
                  >
                    <Plus />
                    Agregar
                  </Button>
                </div>
                <p className="text-caption text-mid-gray">
                  Alias que el asistente entenderá. Ej: "fp" significa "Filipo Pizza".
                </p>
                {shortcuts.length === 0 ? (
                  <p className="text-caption text-mid-gray">Aún no tienes atajos.</p>
                ) : (
                  <div className="space-y-2">
                    {shortcuts.map((s) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Input
                          value={s.key}
                          onChange={(e) => updateShortcut(s.id, 'key', e.target.value)}
                          placeholder="Alias (ej. fp)"
                          className="flex-1"
                        />
                        <span className="text-caption text-mid-gray">→</span>
                        <Input
                          value={s.value}
                          onChange={(e) => updateShortcut(s.id, 'value', e.target.value)}
                          placeholder="Significado (ej. Filipo Pizza)"
                          className="flex-[2]"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeShortcut(s.id)}
                          aria-label="Eliminar atajo"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer botones */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60]">
          <div className="pointer-events-auto rounded-xl border border-border/60 bg-card-bg px-4 py-2 flex items-center gap-3">
            <p className="text-body text-dark-graphite">{toast.text}</p>
            <button
              onClick={() => setToast(null)}
              className="text-mid-gray hover:text-dark-graphite"
              aria-label="Cerrar aviso"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
