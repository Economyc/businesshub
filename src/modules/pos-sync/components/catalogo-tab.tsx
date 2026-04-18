import { useEffect, useState, useMemo } from 'react'
import { Package, Loader2, MapPin, RefreshCw } from 'lucide-react'
import { EmptyState } from '@/core/ui/empty-state'
import { SearchInput } from '@/core/ui/search-input'
import { SelectInput } from '@/core/ui/select-input'
import { formatCurrency } from '@/core/utils/format'
import { usePosCatalogo } from '../hooks'
import type { PosProducto } from '../types'

interface CatalogoTabProps {
  localId: number
  localLabel?: string | null
}

function formatRelative(date: Date | null): string {
  if (!date) return ''
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export function CatalogoTab({ localId, localLabel }: CatalogoTabProps) {
  const { productos, loading, isRefreshing, error, fromCache, lastUpdated, fetch, refresh } =
    usePosCatalogo()
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all')

  useEffect(() => {
    fetch(localId)
  }, [localId, fetch])

  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach((p) => {
      if (p.categoria_descripcion) set.add(p.categoria_descripcion)
    })
    return Array.from(set).sort()
  }, [productos])

  const filtered = useMemo(() => {
    let result = productos
    if (categoriaFilter !== 'all') {
      result = result.filter((p) => p.categoria_descripcion === categoriaFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.productogeneral_descripcion?.toLowerCase().includes(q))
    }
    return result
  }, [productos, categoriaFilter, search])

  const data = filtered.map((p, idx) => ({
    ...p,
    id: String(p.productogeneral_id ?? idx),
  }))

  return (
    <div>
      {/* Hero compacto */}
      <div className="relative bg-surface rounded-2xl card-elevated border border-bone/60 p-5 mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="text-mid-gray shrink-0" />
            <span className="text-caption uppercase tracking-wider text-mid-gray">Local</span>
            <span className="text-caption font-semibold text-dark-graphite truncate">
              {localLabel ?? '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastUpdated && (
              <span className="text-caption text-mid-gray">
                {fromCache ? 'Sincronizado' : 'Actualizado'} {formatRelative(lastUpdated)}
              </span>
            )}
            <button
              type="button"
              onClick={() => refresh(localId)}
              disabled={isRefreshing || loading}
              className="inline-flex items-center gap-1.5 text-caption font-medium text-graphite bg-bone hover:bg-bone/70 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors"
              aria-label="Actualizar catálogo"
            >
              <RefreshCw
                size={12}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              Actualizar
            </button>
          </div>
        </div>
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <div className="text-caption uppercase tracking-wider text-mid-gray mb-1">Productos</div>
            <div className="text-[36px] md:text-[44px] leading-none font-bold text-dark-graphite tabular-nums">
              {productos.length}
            </div>
          </div>
          <div className="text-right">
            <div className="text-caption text-mid-gray">Categorías</div>
            <div className="text-body font-semibold text-dark-graphite tabular-nums">
              {categorias.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar producto..." />
        </div>
        {categorias.length > 0 && (
          <div className="w-full sm:w-60">
            <SelectInput
              value={categoriaFilter}
              onChange={setCategoriaFilter}
              options={[
                { value: 'all', label: 'Todas las categorías' },
                ...categorias.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-body mb-4">{error}</div>
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

      {/* Product card grid */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: PosProducto }) {
  const presentaciones = product.lista_presentacion ?? []
  const variantCount = presentaciones.length
  const modifierCount = product.listaModificadores?.length ?? 0

  const precios = presentaciones
    .map((p) => Number(p.producto_precio))
    .filter((n) => Number.isFinite(n) && n > 0)
  const minPrecio = precios.length > 0 ? Math.min(...precios) : 0
  const maxPrecio = precios.length > 0 ? Math.max(...precios) : 0
  const precioLabel =
    precios.length === 0
      ? formatCurrency(0)
      : minPrecio === maxPrecio
        ? formatCurrency(minPrecio)
        : `desde ${formatCurrency(minPrecio)}`

  return (
    <div className="bg-surface rounded-xl card-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-body font-medium text-dark-graphite block truncate">
            {product.productogeneral_descripcion || '—'}
          </span>
          {product.categoria_descripcion && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bone text-graphite mt-1 w-fit">
              {product.categoria_descripcion}
            </span>
          )}
        </div>
        <span className="text-subheading font-bold text-dark-graphite shrink-0 whitespace-nowrap">
          {precioLabel}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-caption text-mid-gray">
          {variantCount} presentaci{variantCount === 1 ? 'ón' : 'ones'}
        </span>
        {modifierCount > 0 && (
          <span className="text-caption text-mid-gray">
            {modifierCount} modificador{modifierCount !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
