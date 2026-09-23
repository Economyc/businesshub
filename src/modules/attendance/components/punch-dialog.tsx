import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DateInput } from '@/core/ui/date-input'
import { SelectInput } from '@/core/ui/select-input'
import { useAuth } from '@/core/hooks/use-auth'
import { useAddManualPunch, useEditPunchTime, useVoidPunch } from '../hooks'
import { bogotaDateTime, formatTimeBogota, toBogotaDate } from '../services'
import { PUNCH_TYPE_LABEL, type AttendancePunch, type PunchType } from '../types'

// Correcciones a mano de la marcacion. Toda correccion pide un motivo y guarda
// quien la hizo: es lo que despues se revisa si un empleado reclama la nomina.

export type PunchDialogMode =
  | { kind: 'add'; employeeId?: string; employeeName?: string; type?: PunchType; date?: string; time?: string }
  | { kind: 'edit'; punch: AttendancePunch }
  | { kind: 'void'; punch: AttendancePunch }

interface PunchDialogProps {
  mode: PunchDialogMode | null
  /** Empleados elegibles al agregar sin empleado preseleccionado. */
  employees: { id: string; name: string }[]
  onClose: () => void
}

export function PunchDialog({ mode, employees, onClose }: PunchDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {mode && <Body key={JSON.stringify(modeKey(mode))} mode={mode} employees={employees} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function modeKey(mode: PunchDialogMode) {
  return mode.kind === 'add' ? mode : { kind: mode.kind, id: mode.punch.id }
}

/** 'HH:mm' en hora de Colombia de una marcacion. */
function bogotaTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

function Body({ mode, employees, onClose }: { mode: PunchDialogMode; employees: { id: string; name: string }[]; onClose: () => void }) {
  const { user } = useAuth()
  const by = user?.email ?? user?.uid ?? 'desconocido'
  const addPunch = useAddManualPunch()
  const editPunch = useEditPunchTime()
  const voidPunch = useVoidPunch()

  const original = mode.kind === 'add' ? null : mode.punch.at.toDate()
  const [employeeId, setEmployeeId] = useState(mode.kind === 'add' ? mode.employeeId ?? '' : mode.punch.employeeId)
  const [type, setType] = useState<PunchType>(mode.kind === 'add' ? mode.type ?? 'in' : mode.punch.type)
  const [date, setDate] = useState(mode.kind === 'add' ? mode.date ?? toBogotaDate(new Date()) : toBogotaDate(original!))
  const [time, setTime] = useState(mode.kind === 'add' ? mode.time ?? '' : bogotaTime(original!))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pending = addPunch.isPending || editPunch.isPending || voidPunch.isPending

  const presetEmployee = mode.kind === 'add' && !!mode.employeeId
  const employeeName =
    mode.kind === 'add'
      ? mode.employeeName ?? employees.find((e) => e.id === employeeId)?.name ?? ''
      : mode.punch.employeeName

  async function submit() {
    setError(null)
    if (!reason.trim()) return setError('Escribe el motivo de la corrección.')
    try {
      if (mode.kind === 'void') {
        await voidPunch.mutateAsync({ punchId: mode.punch.id, reason: reason.trim(), by })
      } else {
        if (!employeeId) return setError('Elige el empleado.')
        if (!/^\d{2}:\d{2}$/.test(time)) return setError('Escribe la hora.')
        const at = bogotaDateTime(date, time)
        if (at.getTime() > Date.now()) return setError('La hora no puede ser en el futuro.')
        if (mode.kind === 'add') {
          await addPunch.mutateAsync({ employeeId, employeeName, type, at, reason: reason.trim(), by })
        } else {
          await editPunch.mutateAsync({ punch: mode.punch, at, reason: reason.trim(), by })
        }
      }
      onClose()
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.')
    }
  }

  const title =
    mode.kind === 'add' ? 'Agregar marcación' : mode.kind === 'edit' ? 'Corregir hora' : 'Anular marcación'

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {mode.kind === 'void'
            ? `La ${PUNCH_TYPE_LABEL[mode.punch.type].toLowerCase()} de ${mode.punch.employeeName} a las ${formatTimeBogota(original!)} deja de contar en las jornadas y la nómina. No se borra: queda registrada como anulada.`
            : 'Queda marcada como corrección manual, con tu usuario y el motivo.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {mode.kind !== 'void' && (
          <>
            <Field label="Empleado">
              {mode.kind === 'add' && !presetEmployee ? (
                <SelectInput
                  value={employeeId}
                  onChange={setEmployeeId}
                  placeholder="Elegir empleado..."
                  options={employees.map((e) => ({ value: e.id, label: e.name }))}
                />
              ) : (
                <p className="text-body text-dark-graphite">{employeeName}</p>
              )}
            </Field>
            {mode.kind === 'add' && (
              <Field label="Tipo">
                <SelectInput
                  value={type}
                  onChange={(v) => setType(v as PunchType)}
                  options={[{ value: 'in', label: 'Entrada' }, { value: 'out', label: 'Salida' }]}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha">
                <DateInput value={date} onChange={setDate} />
              </Field>
              <Field label="Hora">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
              </Field>
            </div>
            {mode.kind === 'edit' && (
              <p className="text-caption text-mid-gray">Hora registrada: {formatTimeBogota(original!)}</p>
            )}
          </>
        )}
        <Field label="Motivo">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode.kind === 'void' ? 'Ej.: marcó otra persona' : 'Ej.: olvidó marcar la salida'}
            className="h-10"
          />
        </Field>
        {error && <p className="rounded-lg bg-negative-bg p-4 text-body text-negative-text">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant={mode.kind === 'void' ? 'destructive' : 'default'} onClick={submit} disabled={pending}>
          {pending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
          {mode.kind === 'void' ? 'Anular' : 'Guardar'}
        </Button>
      </DialogFooter>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-caption font-semibold uppercase tracking-wider text-mid-gray">{label}</p>
      {children}
    </div>
  )
}
