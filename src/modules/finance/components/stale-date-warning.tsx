import { AlertCircle } from 'lucide-react'
import { isDateTooOld, formatStaleDate, STALE_DATE_MONTHS } from '../utils/date-validation'

interface StaleDateWarningProps {
  /** Fecha en formato ISO YYYY-MM-DD. */
  dateISO: string
  /** Etiqueta del campo, ej. "fecha del documento" / "fecha del pago". */
  fieldLabel?: string
  /**
   * Estado del checkbox de confirmación. Si `confirmed` y `onConfirmChange`
   * vienen, se renderiza el checkbox; si no, solo el texto del aviso (útil
   * cuando la confirmación es un botón aparte, como en la tarjeta del agente).
   */
  confirmed?: boolean
  onConfirmChange?: (value: boolean) => void
}

// Aviso inline cuando una fecha es de hace más de 3 meses (probable error del
// lector IA con el año). No bloquea: con checkbox, exige confirmar; sin él, solo
// informa. Devuelve null si la fecha está dentro de rango.
export function StaleDateWarning({
  dateISO,
  fieldLabel = 'fecha',
  confirmed,
  onConfirmChange,
}: StaleDateWarningProps) {
  if (!isDateTooOld(dateISO)) return null

  const showCheckbox = typeof onConfirmChange === 'function'

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-bg/50 border border-warning/20 text-caption text-warning-text">
      <AlertCircle size={13} strokeWidth={1.5} className="mt-0.5 shrink-0" />
      <div className="space-y-1.5">
        <p>
          Esta {fieldLabel} es de hace más de {STALE_DATE_MONTHS} meses ({formatStaleDate(dateISO)}).
          El lector de IA a veces confunde el año — verifica que sea correcta.
        </p>
        {showCheckbox && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!confirmed}
              onChange={(e) => onConfirmChange?.(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-warning/40 text-warning-text focus:ring-warning/30"
            />
            <span className="font-medium">Confirmo que la fecha es correcta</span>
          </label>
        )}
      </div>
    </div>
  )
}
