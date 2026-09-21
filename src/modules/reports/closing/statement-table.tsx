import { Fragment } from 'react'
import { LINES, LINE_LABEL, LINES_SIN_FUENTE, linesOf } from '@/core/pnl/lines.ts'
import type { Statement } from '@/core/pnl/types.ts'
import { formatCurrency } from '@/core/utils/format'

interface StatementTableProps {
  statement: Statement
}

const SECTIONS = [
  { section: 'revenue' as const, title: 'Ingresos operacionales' },
  { section: 'cogs' as const, title: 'Costo de ventas' },
  { section: 'staff' as const, title: 'Personal' },
  { section: 'opex' as const, title: 'Gastos operacionales' },
]

const pct = (n: number, base: number) => (base > 0 ? `${((n / base) * 100).toFixed(1)}%` : '—')

/**
 * Estado de Resultados con Causado y Pagado lado a lado, igual que la plantilla
 * que usan los socios. Causado dice cómo le fue al mes; Pagado sirve para
 * entender la caja, y por eso los dos van juntos y no en pantallas separadas.
 */
export function StatementTable({ statement }: StatementTableProps) {
  const { accrued, paid } = statement
  const base = accrued.revenue

  const Row = ({ label, a, p, tone = 'data', hint }: {
    label: string
    a: number
    p: number
    tone?: 'data' | 'subtotal' | 'total'
    hint?: string
  }) => {
    const text = tone === 'data' ? 'text-graphite' : 'text-dark-graphite font-medium'
    const bg = tone === 'total' ? 'bg-bone' : tone === 'subtotal' ? 'bg-bone/50' : ''
    return (
      <tr className={`border-b border-border/60 last:border-0 ${bg}`}>
        <td className={`py-2 pl-4 pr-3 text-body ${text}`}>
          {label}
          {hint && <span className="block text-caption text-mid-gray">{hint}</span>}
        </td>
        <td className={`py-2 px-3 text-right text-body tabular-nums ${text}`}>{formatCurrency(a)}</td>
        <td className="py-2 px-3 text-right text-caption text-mid-gray tabular-nums">{pct(a, base)}</td>
        <td className={`py-2 px-3 text-right text-body tabular-nums ${text}`}>{formatCurrency(p)}</td>
        <td className="py-2 pr-4 pl-3 text-right text-caption text-mid-gray tabular-nums">{pct(p, base)}</td>
      </tr>
    )
  }

  return (
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-bone border-b border-border-hover">
            <th className="py-3 pl-4 pr-3 text-left text-caption font-medium text-mid-gray">Concepto</th>
            <th className="py-3 px-3 text-right text-caption font-medium text-mid-gray" colSpan={2}>Causado</th>
            <th className="py-3 px-3 text-right text-caption font-medium text-mid-gray" colSpan={2}>Pagado</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(({ section, title }) => (
            <Fragment key={section}>
              <tr className="bg-bone/60 border-b border-border/60">
                <td colSpan={5} className="py-2 px-4 text-caption font-semibold uppercase tracking-wider text-mid-gray">
                  {title}
                </td>
              </tr>
              {linesOf(section).map((l) => (
                <Row
                  key={l.key}
                  label={l.label}
                  a={accrued.values[l.key]}
                  p={paid.values[l.key]}
                  hint={accrued.values[l.key] === 0 ? LINES_SIN_FUENTE[l.key] : undefined}
                />
              ))}
              {/* El nombre de la seccion coincide con el del subtotal en StatementSide. */}
              <Row
                label={`Total ${title.toLowerCase()}`}
                a={accrued[section]}
                p={paid[section]}
                tone="subtotal"
              />
            </Fragment>
          ))}

          <Row label="EBITDA" a={accrued.ebitda} p={paid.ebitda} tone="total" />

          <tr className="bg-bone/60 border-b border-border/60">
            <td colSpan={5} className="py-2 px-4 text-caption font-semibold uppercase tracking-wider text-mid-gray">
              Financieros, no operacionales e impuestos
            </td>
          </tr>
          {[...linesOf('financial'), ...linesOf('nonop'), ...linesOf('taxes')].map((l) => (
            <Row
              key={l.key}
              label={LINE_LABEL.get(l.key) ?? l.key}
              a={accrued.values[l.key]}
              p={paid.values[l.key]}
              hint={accrued.values[l.key] === 0 ? LINES_SIN_FUENTE[l.key] : undefined}
            />
          ))}

          <Row label="Utilidad neta del mes" a={accrued.net} p={paid.net} tone="total" />
          <Row label="Fondo (5%)" a={accrued.fund} p={paid.fund} />
          <Row
            label="Utilidad después del fondo"
            a={accrued.distributable}
            p={paid.distributable}
            tone="total"
            hint="NO es plata disponible: ver el puente a la caja."
          />
        </tbody>
      </table>
    </div>
  )
}

/** Cuántas líneas tiene la plantilla, para mensajes de carga. */
export const LINE_COUNT = LINES.length
