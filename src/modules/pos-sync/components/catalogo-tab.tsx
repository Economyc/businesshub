import { useEffect, useState, useMemo } from 'react'
import { Package, Loader2, Search } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { SearchInput } from '@/core/ui/search-input'
import { formatCurrency } from '@/core/utils/format'
import { usePosCatalogo } from '../hooks'
import type { PosProducto } from '../types'

interface CatalogoTabProps {
  localId: number
}

export function CatalogoTab({ localId }: CatalogoTabProps) {
  const { productos, loading, error, fetch } = usePosCatalogo()
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')

  useEffect(() => {
    fetch(localId)
  }, [localId, fetch])

  // Extract unique categories
  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => {
      if (p.categoria_nombre) set.add(p.categoria_nombre)
    })
    return Array.from(set).sort()
  }, [productos])

  // Filter products
  const filtered = useMemo(() => {
    let result = productos
    if (categoriaFilter !== 'all') {
      result = result.filter((p) => p.categoria_nombre === categoriaFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.producto_descripcion?.toLowerCase().includes(q))
    }
    return result
  }, [productos, categoriaFilter, search])

  const columns: Column<PosProducto & { id: string }>[] = [
    {
      key: 'nombre',
      header: 'Producto',
      width: '1fr',
      render: (p) => <span className="font-medium text-dark-graphite">{p.producto_descripcion}</span>,
    },
    {
      key: 'categoria',
      header: 'Categoría',
      width: '160px',
      hideOnMobile: true,
      render: (p) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite">
          {p.categoria_nombre ?? '—'}
        </span>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      width: '120px',
      primary: true,
      render: (p) => <span className="font-semibold text-dark-graphite">{formatCurrency(p.producto_precio ?? 0)}</span>,
    },
    {
      key: 'presentaciones',
      header: 'Variantes',
      width: '100px',
      hideOnMobile: true,
      render: (p) => <span className="text-body text-mid-gray">{p.presentaciones?.length ?? 0}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      width: '100px',
      render: (p) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption ${
          p.producto_estado === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {p.producto_estado === 1 ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ]

  const data = filtered.map((p) => ({ ...p, id: String(p.producto_id ?? Math.random()) }))

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto..." />
        </div>
        {categorias.length > 0 && (
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="text-body bg-surface border border-border rounded-lg px-3 py-2 text-graphite"
          >
            <option value="all">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-mid-gray" />
          <span className="ml-2 text-body text-mid-gray">Cargando catálogo del POS...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && productos.length === 0 && !error && (
        <EmptyState
          icon={Package}
          title="Sin productos"
          description="No se encontraron productos en el catálogo del POS para este local."
        />
      )}

      {/* Summary */}
      {!loading && productos.length > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <span className="text-body text-mid-gray">
            {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
            {categoriaFilter !== 'all' && ` en ${categoriaFilter}`}
            {search && ` con "${search}"`}
          </span>
          <span className="text-body text-mid-gray">
            {categorias.length} categoría{categorias.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {data.length > 0 && <DataTable columns={columns} data={data} />}
    </div>
  )
}
