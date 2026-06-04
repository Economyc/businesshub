import { ChefHat } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import type { PreparationAvailabilityRow } from '../domain/compute-availability'

interface StockPreparationsTableProps {
  rows: PreparationAvailabilityRow[]
  itemNameById: Record<string, string>
  onNavigate?: (tab: 'recipes') => void
}

interface PrepRow extends PreparationAvailabilityRow {
  id: string
}

/** Disponibilidad por preparación: cuántos lotes/porciones puedo producir hoy. */
export function StockPreparationsTable({ rows, itemNameById, onNavigate }: StockPreparationsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ChefHat size={40} strokeWidth={1} className="text-smoke mb-4" />
        <h3 className="text-subheading font-medium text-graphite mb-1">Sin preparaciones</h3>
        <p className="text-body text-mid-gray mb-4">
          Crea sub-recetas (salsas, mezclas) en la pestaña Recetas para ver cuántos lotes puedes producir.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('recipes')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            <ChefHat size={16} strokeWidth={1.5} />
            Ir a Recetas
          </button>
        )}
      </div>
    )
  }

  const data: PrepRow[] = rows.map((r) => ({ ...r, id: r.recipeId }))

  const columns: Column<PrepRow>[] = [
    {
      key: 'name',
      header: 'Preparación',
      width: '2fr',
      primary: true,
      render: (r) => <span className="font-medium text-dark-graphite truncate">{r.name || '(sin nombre)'}</span>,
    },
    {
      key: 'yield',
      header: 'Rinde',
      width: '1fr',
      render: (r) => <span className="text-graphite">{r.yieldQty.toLocaleString('es-CO')} porc.</span>,
    },
    {
      key: 'available',
      header: 'Disponible',
      width: '1.4fr',
      render: (r) =>
        r.blocked ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-negative-bg text-negative-text">
            Sin stock
          </span>
        ) : (
          <span className="text-graphite">
            ≈ {r.batches.toLocaleString('es-CO')} {r.batches === 1 ? 'lote' : 'lotes'}{' '}
            <span className="text-mid-gray">({r.portions.toLocaleString('es-CO')} porc.)</span>
          </span>
        ),
    },
    {
      key: 'limiting',
      header: 'Limita',
      width: '1.4fr',
      render: (r) =>
        r.limitingItemId ? (
          <span className="text-mid-gray truncate">{itemNameById[r.limitingItemId] ?? r.limitingItemId}</span>
        ) : (
          '—'
        ),
    },
  ]

  return <DataTable columns={columns} data={data} />
}
