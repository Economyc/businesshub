import { Loader2 } from 'lucide-react'

interface LoadMoreButtonProps {
  onClick: () => void
  loading: boolean
  hasMore: boolean
  loadedCount: number
  totalCount: number | null
}

export function LoadMoreButton({ onClick, loading, hasMore, loadedCount, totalCount }: LoadMoreButtonProps) {
  if (!hasMore) return null

  return (
    <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-divider">
      <span className="text-caption text-mid-gray">
        Mostrando {loadedCount}{totalCount !== null ? ` de ${totalCount}` : ''}
      </span>
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-body font-medium text-graphite bg-cloud hover:bg-smoke transition-all duration-200 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Cargando...
          </>
        ) : (
          'Cargar más'
        )}
      </button>
    </div>
  )
}
