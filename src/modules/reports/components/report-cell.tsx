import { formatCurrency } from '@/core/utils/format'
import { getChannelStyle } from '@/modules/pos-sync/utils/sales-channel'
import type { ReportColumn, ReportRow } from '../domain/builders'

export function isNumericColumn(col: ReportColumn): boolean {
  return col.type !== 'text' && col.type !== 'channel'
}

const pct = (n: number) => `${n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

// Mismas clases que Badge, pero sin pasar por su cn(): tailwind-merge descarta
// `text-caption` al combinarla con el color de la variante y el badge sale a 14px.
const PILL = 'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap'
const TONE = {
  positive: 'bg-positive-bg text-positive-text',
  negative: 'bg-negative-bg text-negative-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-smoke text-graphite',
}

function VariationCell({ value, current }: { value: number | null; current: number }) {
  if (value === null) {
    return current > 0 ? <span className={`${PILL} ${TONE.info}`}>Nuevo</span> : <span className="text-mid-gray">—</span>
  }
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  const tone = rounded > 0 ? TONE.positive : rounded < 0 ? TONE.negative : TONE.neutral
  return <span className={`${PILL} ${tone}`}>{`${sign}${pct(Math.abs(rounded))}`}</span>
}

export function ReportCell({ column, row }: { column: ReportColumn; row: ReportRow }) {
  const value = row.values[column.key]

  switch (column.type) {
    case 'channel': {
      if (row.kind !== 'data' || !row.channel) return <>{value ?? ''}</>
      const { className, style } = getChannelStyle(row.channel)
      // Template string, no cn(): tailwind-merge descartaría `text-caption` al lado de `text-white`.
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption ${className}`} style={style}>
          {value}
        </span>
      )
    }
    // Ceros en gris: en tablas anchas (productos × canal) dejan ver dónde hay venta.
    case 'integer':
      if (typeof value !== 'number') return <Dash />
      return <span className={Math.round(value) === 0 ? 'text-mid-gray' : ''}>{Math.round(value).toLocaleString('es-CO')}</span>
    case 'currency':
      if (typeof value !== 'number') return <Dash />
      return <span className={Math.round(value) === 0 ? 'text-mid-gray' : ''}>{formatCurrency(Math.round(value))}</span>
    case 'percent':
      return typeof value === 'number' ? <>{pct(value)}</> : <Dash />
    case 'variation': {
      const current = column.currentKey ? row.values[column.currentKey] : null
      return <VariationCell value={typeof value === 'number' ? value : null} current={typeof current === 'number' ? current : 0} />
    }
    default:
      return value === null || value === undefined || value === '' ? <Dash /> : <>{value}</>
  }
}

function Dash() {
  return <span className="text-mid-gray">—</span>
}
