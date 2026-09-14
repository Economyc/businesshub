import { Skeleton } from '@/core/ui/skeleton'
import type { ReportColumn, ReportRow, ReportTableData } from '../domain/builders'
import { ReportCell, isNumericColumn } from './report-cell'

// Clases armadas con template strings y no con cn(): tailwind-merge no conoce la
// escala `text-caption` del Design System, la toma por un color y la descarta al
// lado de `text-mid-gray`.

const ROW_CLASS: Record<ReportRow['kind'], string> = {
  group: '',
  data: 'border-b border-border text-graphite hover:bg-bone transition-colors',
  subtotal: 'border-b border-border font-medium text-dark-graphite',
  total: 'font-semibold text-dark-graphite',
}

// Encabezados en caja normal y peso medio: en mayúsculas con tracking, títulos
// como "Venta periodo anterior" se leían más grandes que los datos.
// `first:` solo en la fila superior: en la segunda fila la primera celda no es
// la primera columna de la tabla.
const HEAD = 'px-3 last:pr-[18px] text-caption font-medium text-mid-gray whitespace-nowrap'
// Fondo por celda con 1px de solape: las celdas caen en medios píxeles (rem de
// 14,4px) y un fondo pintado en la fila deja costuras claras entre columnas.
const FILL = 'bg-bone shadow-[1px_0_0_var(--color-bone)]'
const BODY_CELL = 'px-3 py-3 first:pl-[18px] last:pr-[18px] whitespace-nowrap tabular-nums'

const align = (col: ReportColumn) => (isNumericColumn(col) ? 'text-right' : 'text-left')

interface HeaderCell {
  key: string
  label: string
  colSpan: number
  rowSpan: number
  className: string
}

/** Primera fila del encabezado: columnas sueltas (ocupan 2 filas) y grupos con colSpan. */
function topHeaderCells(columns: ReportColumn[], twoRows: boolean): HeaderCell[] {
  const cells: HeaderCell[] = []
  for (let i = 0; i < columns.length; ) {
    const col = columns[i]
    if (!col.group) {
      cells.push({
        key: col.key,
        label: col.label ?? col.header,
        colSpan: 1,
        rowSpan: twoRows ? 2 : 1,
        className: `${align(col)} py-3 border-b border-border-hover`,
      })
      i++
      continue
    }
    let j = i
    while (j < columns.length && columns[j].group === col.group) j++
    cells.push({
      key: `group-${i}`,
      label: col.group,
      colSpan: j - i,
      rowSpan: 1,
      className: 'text-center pt-3 pb-1 border-l border-border first:border-l-0',
    })
    i = j
  }
  return cells
}

interface ReportTableProps {
  table: ReportTableData
  /** Periodo anterior cargando: las columnas que dependen de él muestran un placeholder. */
  previousPending?: boolean
  /** Hoja de una fila por pedido: altura acotada con encabezado fijo y tope de filas. */
  detail?: boolean
}

const DETAIL_MAX_ROWS = 1000

/**
 * Tabla de informe con filas de grupo, subtotal y total. Mismo lenguaje visual
 * que DataTable (cabecera bone, bordes de 1px), pero con <table> real: las
 * columnas se alinean solas, admite encabezados agrupados y las hojas anchas
 * hacen scroll horizontal.
 */
export function ReportTable({ table, previousPending = false, detail = false }: ReportTableProps) {
  const { columns } = table
  const twoRows = columns.some((c) => c.group)
  const rows = detail ? table.rows.slice(0, DETAIL_MAX_ROWS) : table.rows
  const hidden = table.rows.length - rows.length
  const sticky = detail ? 'sticky top-0 z-10' : ''

  return (
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <div className={detail ? 'overflow-auto max-h-[640px]' : 'overflow-x-auto'}>
        <table className="w-full border-collapse text-body">
          <thead>
            <tr>
              {topHeaderCells(columns, twoRows).map((cell) => (
                <th
                  key={cell.key}
                  scope="col"
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className={`${HEAD} ${FILL} first:pl-[18px] ${sticky} ${cell.className}`}
                >
                  {cell.label}
                </th>
              ))}
            </tr>
            {twoRows && (
              <tr>
                {columns
                  .filter((c) => c.group)
                  .map((col, i, grouped) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`${HEAD} ${FILL} ${sticky} pt-1 pb-3 border-b border-border-hover ${align(col)} ${
                        i === 0 || grouped[i - 1].group !== col.group ? 'border-l border-border' : ''
                      }`}
                    >
                      {col.label ?? col.header}
                    </th>
                  ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, i) =>
              row.kind === 'group' ? (
                <tr key={i}>
                  <th
                    scope="rowgroup"
                    colSpan={columns.length}
                    className="px-[18px] py-2 bg-card-bg border-b border-border text-left text-caption font-medium text-mid-gray"
                  >
                    {row.values[columns[0].key]}
                  </th>
                </tr>
              ) : (
                <tr key={i} className={ROW_CLASS[row.kind]}>
                  {columns.map((col) => (
                    <td key={col.key} className={`${BODY_CELL} ${align(col)} ${row.kind === 'total' ? FILL : ''}`}>
                      {previousPending && col.dependsOnPrevious ? (
                        <Skeleton className="ml-auto h-4 w-16 rounded" />
                      ) : (
                        <ReportCell column={col} row={row} />
                      )}
                    </td>
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <div className="px-[18px] py-3 border-t border-border bg-card-bg text-caption text-mid-gray">
          Mostrando {rows.length.toLocaleString('es-CO')} de {table.rows.length.toLocaleString('es-CO')} pedidos. La
          descarga incluye todos.
        </div>
      )}
    </div>
  )
}
