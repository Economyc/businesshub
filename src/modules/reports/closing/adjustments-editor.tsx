import { useState } from 'react'
import { Plus, Trash2, Lock } from 'lucide-react'
import { LINES } from '@/core/pnl/lines.ts'
import type { ClosingManualItem } from '@/core/pnl/closing.ts'
import { formatCurrency } from '@/core/utils/format'
import { newItemId } from './service'

interface AdjustmentsEditorProps {
  title: string
  description: string
  items: ClosingManualItem[]
  onChange: (items: ClosingManualItem[]) => void
  /** Cabecera con el origen de las cifras (el extracto del que salieron). */
  source?: string
  onSourceChange?: (source: string) => void
  readOnly?: boolean
  /** Línea por defecto de un item nuevo. */
  defaultLine?: string
}

const inputClass =
  'w-full rounded-lg border border-border bg-card-bg px-3 py-1.5 text-body text-graphite transition-colors hover:border-border-hover focus:border-border-hover focus:outline-none disabled:bg-bone disabled:text-mid-gray'

/**
 * Campo de dinero con formato en vivo.
 *
 * Acepta negativos a proposito: hay contra-asientos de reparto (media factura
 * de honorarios que le toca a otra sede, un arriendo de mes vencido) que entran
 * con signo menos. `CurrencyInput` no sirve aca porque devuelve solo digitos.
 *
 * El texto mostrado esta SIEMPRE formateado, incluso mientras se escribe. La
 * version anterior cambiaba a crudo al enfocar, y ese cambio de valor invalidaba
 * la seleccion del texto: al reemplazar el contenido, lo viejo y lo nuevo
 * terminaban concatenados y $618.594 se convertia en $6.185.945.000.000. Sin
 * cambio de modo, esa clase de error no existe.
 */
function MoneyInput({ value, onChange, disabled }: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  // `text` conserva lo tecleado (p. ej. un "-" suelto, que no es un numero aun).
  const [text, setText] = useState<string | null>(null)

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={text ?? (value === 0 ? '' : formatCurrency(value))}
      placeholder="$0"
      onBlur={() => setText(null)}
      onChange={(e) => {
        const entrada = e.target.value
        const negativo = entrada.trim().startsWith('-')
        const digitos = entrada.replace(/[^\d]/g, '')
        const n = digitos === '' ? 0 : Number(digitos) * (negativo ? -1 : 1)
        if (!Number.isFinite(n)) return
        onChange(n)
        setText(digitos === '' ? (negativo ? '-' : '') : formatCurrency(n))
      }}
      className={`${inputClass} text-right tabular-nums`}
    />
  )
}

export function AdjustmentsEditor({
  title, description, items, onChange, source, onSourceChange, readOnly, defaultLine,
}: AdjustmentsEditorProps) {
  const patch = (id: string, next: Partial<ClosingManualItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...next } : it)))

  const add = () =>
    onChange([
      ...items,
      {
        id: newItemId(),
        line: defaultLine ?? 'fin_expense',
        concept: '',
        accrued: 0,
        paid: 0,
        origin: 'manual',
      },
    ])

  const total = items.reduce((s, i) => s + i.accrued, 0)

  return (
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-subheading font-medium text-dark-graphite">{title}</h3>
          <p className="text-caption text-mid-gray">{description}</p>
        </div>
        <span className="text-body text-graphite tabular-nums">{formatCurrency(total)}</span>
      </div>

      {onSourceChange && (
        <div className="px-6 py-3 border-b border-border/60 bg-bone/50">
          <label className="block text-caption font-semibold uppercase tracking-wider text-mid-gray mb-2">
            De dónde salieron estas cifras
          </label>
          <input
            type="text"
            value={source ?? ''}
            disabled={readOnly}
            placeholder="Extracto bancario de agosto 2026"
            onChange={(e) => onSourceChange(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-6 py-6 text-body text-mid-gray">
          Nada capturado todavía.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-bone border-b border-border/60">
                <th className="py-2 pl-6 pr-3 text-left text-caption font-medium text-mid-gray">Línea del P&amp;L</th>
                <th className="py-2 px-3 text-left text-caption font-medium text-mid-gray">Concepto</th>
                <th className="py-2 px-3 text-right text-caption font-medium text-mid-gray w-36">Causado</th>
                <th className="py-2 px-3 text-right text-caption font-medium text-mid-gray w-36">Pagado</th>
                <th className="py-2 pr-6 pl-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const locked = readOnly || it.origin === 'bank'
                return (
                  <tr key={it.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pl-6 pr-3">
                      <select
                        value={it.line}
                        disabled={locked}
                        onChange={(e) => patch(it.id, { line: e.target.value })}
                        className={inputClass}
                      >
                        {LINES.map((l) => (
                          <option key={l.key} value={l.key}>{l.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {it.origin === 'bank' && (
                          <Lock size={14} strokeWidth={1.5} className="shrink-0 text-mid-gray" />
                        )}
                        <input
                          type="text"
                          value={it.concept}
                          disabled={locked}
                          placeholder="4x1000 (GMF)"
                          onChange={(e) => patch(it.id, { concept: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <MoneyInput
                        value={it.accrued}
                        disabled={locked}
                        onChange={(v) => patch(it.id, { accrued: v })}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <MoneyInput
                        value={it.paid}
                        disabled={locked}
                        onChange={(v) => patch(it.id, { paid: v })}
                      />
                    </td>
                    <td className="py-2 pr-6 pl-3">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => onChange(items.filter((x) => x.id !== it.id))}
                        aria-label={`Quitar ${it.concept || 'ajuste'}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-mid-gray transition-colors hover:bg-negative-bg hover:text-negative-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-mid-gray"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly && (
        <div className="px-6 py-3 border-t border-border/60">
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-2 text-body text-graphite transition-colors hover:text-dark-graphite"
          >
            <Plus size={16} strokeWidth={1.5} />
            Agregar
          </button>
        </div>
      )}
    </div>
  )
}
