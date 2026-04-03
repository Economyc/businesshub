import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  width?: string
  /** Hide this column in mobile card view */
  hideOnMobile?: boolean
  /** Show this column as the card's primary value (right-aligned, larger) */
  primary?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (item: T) => void
}

const ROW_HEIGHT = 57
const CARD_HEIGHT = 88
const OVERSCAN = 5

export function DataTable<T extends { id: string }>({ columns, data, onRowClick }: DataTableProps<T>) {
  const gridCols = columns.map((c) => c.width ?? '1fr').join(' ')
  const visibleMobileCols = columns.filter((c) => c.key !== 'actions' && !c.hideOnMobile)
  const primaryCol = visibleMobileCols.find((c) => c.primary)
  const detailCols = visibleMobileCols.filter((c) => c !== primaryCol)

  const desktopScrollRef = useRef<HTMLDivElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)

  const desktopVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => desktopScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  const mobileVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: OVERSCAN,
    gap: 8,
  })

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-surface rounded-xl card-elevated overflow-hidden">
        <div
          className="grid px-[18px] py-3 text-caption uppercase tracking-wider text-mid-gray bg-bone"
          style={{ gridTemplateColumns: gridCols, borderBottom: '1px solid #d4d3cf' }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="font-semibold px-3 first:pl-0 last:pr-0 flex items-center"
            >
              {col.header}
            </div>
          ))}
        </div>
        <div
          ref={desktopScrollRef}
          style={{ maxHeight: '600px', overflow: 'auto' }}
        >
          <div
            style={{
              height: desktopVirtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {desktopVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = data[virtualRow.index]
              return (
                <div
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={`grid items-center px-[18px] py-0 text-body text-graphite hover:bg-bone transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    gridTemplateColumns: gridCols,
                    borderBottom: virtualRow.index < data.length - 1 ? '1px solid #e5e4e0' : 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className="px-3 py-0 first:pl-0 last:pr-0 flex items-center"
                    >
                      {col.render(item)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div
        ref={mobileScrollRef}
        className="md:hidden"
        style={{ maxHeight: '80vh', overflow: 'auto' }}
      >
        <div
          style={{
            height: mobileVirtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index]
            return (
              <div
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={`bg-surface rounded-xl card-elevated p-4 text-body text-graphite active:bg-bone/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Primary row: first column + primary value */}
                {primaryCol && detailCols.length > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-dark-graphite">{detailCols[0].render(item)}</div>
                    <div className="font-semibold text-dark-graphite">{primaryCol.render(item)}</div>
                  </div>
                )}
                {/* Detail rows */}
                <div className="space-y-1">
                  {(primaryCol ? detailCols.slice(1) : detailCols).map((col) => (
                    <div key={col.key} className="flex items-center justify-between text-caption">
                      <span className="text-mid-gray">{col.header}</span>
                      <span className="text-graphite">{col.render(item)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
