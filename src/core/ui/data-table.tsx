import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
}

export function DataTable<T extends { id: string }>({ columns, data, onRowClick }: DataTableProps<T>) {
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ')

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div
        className="grid px-[18px] py-3 text-caption uppercase tracking-wider text-mid-gray border-b border-border bg-card-bg"
        style={{ gridTemplateColumns: gridCols }}
      >
        {columns.map((col) => (
          <div key={col.key}>{col.header}</div>
        ))}
      </div>
      {data.map((item) => (
        <div
          key={item.id}
          onClick={() => onRowClick?.(item)}
          className="grid px-[18px] py-3.5 text-body text-graphite border-b border-bone last:border-b-0 hover:bg-card-bg transition-colors duration-150 cursor-pointer items-center"
          style={{ gridTemplateColumns: gridCols }}
        >
          {columns.map((col) => (
            <div key={col.key}>{col.render(item)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
