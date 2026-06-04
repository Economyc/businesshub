import { BookOpen } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import type { ProductAvailabilityRow } from '../domain/compute-availability'

interface StockProductsTableProps {
  rows: ProductAvailabilityRow[]
  itemNameById: Record<string, string>
  onNavigate?: (tab: 'recipes') => void
}

interface ProductRow extends ProductAvailabilityRow {
  id: string
}

/** Disponibilidad de venta por producto: cuántas porciones alcanzo a producir hoy. */
export function StockProductsTable({ rows, itemNameById, onNavigate }: StockProductsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen size={40} strokeWidth={1} className="text-smoke mb-4" />
        <h3 className="text-subheading font-medium text-graphite mb-1">Sin productos con receta</h3>
        <p className="text-body text-mid-gray mb-4">
          Crea las recetas de tus productos vendibles para ver cuántas porciones puedes producir.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('recipes')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            <BookOpen size={16} strokeWidth={1.5} />
            Ir a Recetas
          </button>
        )}
      </div>
    )
  }

  const data: ProductRow[] = rows.map((r) => ({ ...r, id: r.recipeId }))

  const columns: Column<ProductRow>[] = [
    {
      key: 'name',
      header: 'Producto',
      width: '2fr',
      primary: true,
      render: (r) => <span className="font-medium text-dark-graphite truncate">{r.name || '(sin nombre)'}</span>,
    },
    {
      key: 'available',
      header: 'Disponible',
      width: '1.2fr',
      render: (r) =>
        r.blocked ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-negative-bg text-negative-text">
            Sin stock
          </span>
        ) : (
          <span className="text-graphite">≈ {r.available.toLocaleString('es-CO')} porc.</span>
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
