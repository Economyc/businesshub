import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-bone/80', className)} />
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block bg-surface rounded-xl card-elevated overflow-hidden">
        {/* Header */}
        <div
          className="grid px-5 py-3 bg-bone/60 gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, borderBottom: '1px solid #d4d3cf' }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20 rounded" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div
            key={ri}
            className="grid items-center px-5 py-4 gap-4"
            style={{
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              borderBottom: ri < rows - 1 ? '1px solid #e5e4e0' : 'none',
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <Skeleton key={ci} className={cn('h-4 rounded', ci === 0 ? 'w-32' : 'w-20')} />
            ))}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="bg-surface rounded-xl card-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="bg-surface rounded-xl p-[18px] card-elevated">
      <div className="flex justify-between items-center mb-2.5">
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-7 w-24 rounded mb-1" />
      <Skeleton className="h-3 w-14 rounded" />
    </div>
  )
}

export function DashboardSkeleton({ kpiCount = 4, charts = 2 }: { kpiCount?: number; charts?: number }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className={cn(
        'grid gap-4',
        kpiCount <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      )}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Chart placeholders */}
      <div className={cn('grid gap-6', charts === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
        {Array.from({ length: charts }).map((_, i) => (
          <div key={i} className="bg-surface rounded-xl card-elevated p-6">
            <Skeleton className="h-5 w-40 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HomeCardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface rounded-xl card-elevated p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="bg-bone/50 rounded-lg px-3 py-2.5">
                <Skeleton className="h-3 w-16 rounded mb-2" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            ))}
          </div>
          {/* Footer */}
          <Skeleton className="h-3 w-48 rounded" />
        </div>
      ))}
    </div>
  )
}

export function CarteraSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface rounded-xl card-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        ))}
      </div>
      {/* Table */}
      <TableSkeleton rows={5} columns={5} />
    </div>
  )
}
