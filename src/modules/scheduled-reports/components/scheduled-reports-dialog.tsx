// Wave 5.2 — Reportes programados (UI).
//
// Dialog que permite al usuario listar, crear, activar/pausar y borrar
// reportes recurrentes. Sigue DESIGN_SYSTEM: tokens, escalas tipográficas
// fijas, spacing en múltiplos de 4, sin sombras.

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/core/hooks/use-company'
import { cn } from '@/lib/utils'
import { scheduledReportService } from '../services'
import {
  CHANNEL_LABELS,
  DAY_OF_WEEK_LABELS,
  PERIOD_LABELS,
  REPORT_TYPE_LABELS,
  type ScheduledReport,
  type ScheduledReportChannel,
  type ScheduledReportFormData,
  type ScheduledReportPeriod,
  type ScheduledReportType,
} from '../types'

interface ScheduledReportsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  name: string
  reportType: ScheduledReportType
  period: ScheduledReportPeriod
  dayOfWeek: number
  dayOfMonth: number
  hour: number
  channel: ScheduledReportChannel
  recipient: string
}

const DEFAULT_FORM: FormState = {
  name: '',
  reportType: 'pnl',
  period: 'weekly',
  dayOfWeek: 1,
  dayOfMonth: 1,
  hour: 8,
  channel: 'firestore',
  recipient: '',
}

function describeSchedule(report: ScheduledReport): string {
  const hourLabel = `${String(report.hour).padStart(2, '0')}:00`
  if (report.period === 'daily') return `Diario a las ${hourLabel}`
  if (report.period === 'weekly') {
    const day = DAY_OF_WEEK_LABELS[report.dayOfWeek ?? 1] ?? 'Lunes'
    return `Cada ${day} a las ${hourLabel}`
  }
  const dom = report.dayOfMonth ?? 1
  return `Cada día ${dom} a las ${hourLabel}`
}

export function ScheduledReportsDialog({ open, onOpenChange }: ScheduledReportsDialogProps) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id ?? null

  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)

  useEffect(() => {
    if (!open || !companyId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    scheduledReportService
      .list(companyId)
      .then((data) => {
        if (!cancelled) setReports(data)
      })
      .catch((err) => {
        console.error('Error cargando reportes programados:', err)
        if (!cancelled) setError('No se pudieron cargar los reportes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, companyId])

  function resetForm() {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function startNew() {
    setForm(DEFAULT_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(report: ScheduledReport) {
    setForm({
      name: report.name,
      reportType: report.reportType,
      period: report.period,
      dayOfWeek: report.dayOfWeek ?? 1,
      dayOfMonth: report.dayOfMonth ?? 1,
      hour: report.hour,
      channel: report.channel,
      recipient: report.recipient,
    })
    setEditingId(report.id)
    setShowForm(true)
  }

  const validationError = useMemo(() => {
    if (!showForm) return null
    if (!form.name.trim()) return 'El nombre es obligatorio.'
    if (form.channel !== 'firestore' && !form.recipient.trim()) {
      return 'El destinatario es obligatorio para email o WhatsApp.'
    }
    if (form.period === 'weekly' && (form.dayOfWeek < 0 || form.dayOfWeek > 6)) {
      return 'Día de la semana inválido.'
    }
    if (form.period === 'monthly' && (form.dayOfMonth < 1 || form.dayOfMonth > 31)) {
      return 'Día del mes inválido.'
    }
    if (form.hour < 0 || form.hour > 23) return 'La hora debe estar entre 0 y 23.'
    return null
  }, [showForm, form])

  async function handleSave() {
    if (!companyId || saving || validationError) return
    setSaving(true)
    setError(null)
    try {
      const payload: ScheduledReportFormData = {
        name: form.name.trim(),
        reportType: form.reportType,
        period: form.period,
        hour: form.hour,
        channel: form.channel,
        recipient: form.recipient.trim(),
        enabled: editingId
          ? reports.find((r) => r.id === editingId)?.enabled ?? true
          : true,
      }
      if (form.period === 'weekly') payload.dayOfWeek = form.dayOfWeek
      if (form.period === 'monthly') payload.dayOfMonth = form.dayOfMonth

      if (editingId) {
        await scheduledReportService.update(companyId, editingId, payload)
      } else {
        await scheduledReportService.create(companyId, payload)
      }
      const fresh = await scheduledReportService.list(companyId)
      setReports(fresh)
      resetForm()
    } catch (err) {
      console.error('Error guardando reporte:', err)
      setError('No se pudo guardar el reporte.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(report: ScheduledReport) {
    if (!companyId) return
    try {
      await scheduledReportService.toggle(companyId, report.id, !report.enabled)
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, enabled: !r.enabled } : r)),
      )
    } catch (err) {
      console.error('Error cambiando estado:', err)
      setError('No se pudo cambiar el estado del reporte.')
    }
  }

  async function handleDelete(report: ScheduledReport) {
    if (!companyId) return
    const ok = window.confirm(`¿Eliminar el reporte "${report.name}"?`)
    if (!ok) return
    try {
      await scheduledReportService.remove(companyId, report.id)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      if (editingId === report.id) resetForm()
    } catch (err) {
      console.error('Error eliminando reporte:', err)
      setError('No se pudo eliminar el reporte.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-subheading text-dark-graphite">
            Reportes programados
          </DialogTitle>
          <DialogDescription className="text-caption text-mid-gray">
            Configura reportes recurrentes que se generan y entregan automáticamente.
          </DialogDescription>
        </DialogHeader>

        {!companyId ? (
          <p className="text-body text-mid-gray py-4">Selecciona un local primero.</p>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-border/60 bg-negative-bg px-4 py-2">
                <p className="text-caption text-negative-text">{error}</p>
              </div>
            )}

            {/* Lista */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-body font-medium text-dark-graphite">
                  Reportes activos
                </h3>
                {!showForm && (
                  <Button type="button" variant="ghost" size="sm" onClick={startNew}>
                    <Plus />
                    Nuevo reporte
                  </Button>
                )}
              </div>

              {loading ? (
                <p className="text-caption text-mid-gray">Cargando…</p>
              ) : reports.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card-bg p-6 text-center">
                  <p className="text-body text-mid-gray">
                    Aún no tienes reportes programados.
                  </p>
                  <p className="text-caption text-mid-gray mt-2">
                    Crea uno para recibir resúmenes automáticos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className={cn(
                        'rounded-xl border border-border/60 bg-card-bg p-4',
                        editingId === report.id && 'bg-bone',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-body font-medium text-dark-graphite truncate">
                              {report.name}
                            </p>
                            <Badge variant={report.enabled ? 'positive' : 'outline'}>
                              {report.enabled ? 'Activo' : 'Pausado'}
                            </Badge>
                          </div>
                          <p className="text-caption text-mid-gray">
                            {REPORT_TYPE_LABELS[report.reportType]} · {describeSchedule(report)}
                          </p>
                          <p className="text-caption text-mid-gray">
                            Canal: {CHANNEL_LABELS[report.channel]}
                            {report.channel !== 'firestore' && report.recipient
                              ? ` → ${report.recipient}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(report)}
                          >
                            {report.enabled ? 'Pausar' : 'Activar'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(report)}
                            aria-label="Editar"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(report)}
                            aria-label="Eliminar"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form */}
            {showForm && (
              <div className="rounded-xl border border-border/60 bg-card-bg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-body font-medium text-dark-graphite">
                    {editingId ? 'Editar reporte' : 'Nuevo reporte'}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={resetForm}
                    aria-label="Cerrar formulario"
                  >
                    <X />
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-caption text-dark-graphite font-medium">Nombre</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: P&L semanal"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-caption text-dark-graphite font-medium">
                      Tipo de reporte
                    </label>
                    <Select
                      value={form.reportType}
                      onValueChange={(v: unknown) =>
                        setForm((f) => ({ ...f, reportType: (v as ScheduledReportType) ?? 'pnl' }))
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
                        {(Object.keys(REPORT_TYPE_LABELS) as ScheduledReportType[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {REPORT_TYPE_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-caption text-dark-graphite font-medium">
                      Frecuencia
                    </label>
                    <Select
                      value={form.period}
                      onValueChange={(v: unknown) =>
                        setForm((f) => ({
                          ...f,
                          period: (v as ScheduledReportPeriod) ?? 'weekly',
                        }))
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
                        {(Object.keys(PERIOD_LABELS) as ScheduledReportPeriod[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {PERIOD_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {form.period === 'weekly' && (
                    <div className="space-y-2">
                      <label className="text-caption text-dark-graphite font-medium">
                        Día de la semana
                      </label>
                      <Select
                        value={String(form.dayOfWeek)}
                        onValueChange={(v: unknown) =>
                          setForm((f) => ({ ...f, dayOfWeek: Number(v) }))
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
                          {Object.entries(DAY_OF_WEEK_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.period === 'monthly' && (
                    <div className="space-y-2">
                      <label className="text-caption text-dark-graphite font-medium">
                        Día del mes (1–31)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={form.dayOfMonth}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            dayOfMonth: Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                          }))
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-caption text-dark-graphite font-medium">
                      Hora (Bogotá, 0–23)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={form.hour}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-caption text-dark-graphite font-medium">Canal</label>
                    <Select
                      value={form.channel}
                      onValueChange={(v: unknown) =>
                        setForm((f) => ({
                          ...f,
                          channel: (v as ScheduledReportChannel) ?? 'firestore',
                        }))
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
                        {(Object.keys(CHANNEL_LABELS) as ScheduledReportChannel[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {CHANNEL_LABELS[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.channel !== 'firestore' && (
                    <div className="space-y-2">
                      <label className="text-caption text-dark-graphite font-medium">
                        {form.channel === 'email' ? 'Email destino' : 'WhatsApp destino'}
                      </label>
                      <Input
                        value={form.recipient}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, recipient: e.target.value }))
                        }
                        placeholder={
                          form.channel === 'email' ? 'reportes@empresa.com' : '+573001234567'
                        }
                      />
                    </div>
                  )}
                </div>

                {form.channel !== 'firestore' && (
                  <p className="text-caption text-mid-gray">
                    Mientras no haya credenciales de {form.channel === 'email' ? 'SendGrid' : 'Twilio'}, el reporte se guardará en el sistema y podrás revisarlo desde aquí.
                  </p>
                )}

                {validationError && (
                  <p className="text-caption text-negative-text">{validationError}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || Boolean(validationError)}
                  >
                    {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear reporte'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
