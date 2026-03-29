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
    <div className="bg-surface rounded-xl card-elevated overflow-hidden">
      <div
        className="grid px-5 py-3 text-caption uppercase tracking-wider text-mid-gray bg-bone/60"
        style={{ gridTemplateColumns: gridCols, borderBottom: '1px solid #d4d3cf' }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="font-medium px-3 first:pl-0 last:pr-0 flex items-center"
          >
            {col.header}
          </div>
        ))}
      </div>
      {data.map((item, index) => (
        <div
          key={item.id}
          onClick={() => onRowClick?.(item)}
          className={`grid px-5 py-0 text-body text-graphite hover:bg-bone/50 transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
          style={{
            gridTemplateColumns: gridCols,
            borderBottom: index < data.length - 1 ? '1px solid #e5e4e0' : 'none',
          }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-3 py-4 first:pl-0 last:pr-0 flex items-center"
            >
              {col.render(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
