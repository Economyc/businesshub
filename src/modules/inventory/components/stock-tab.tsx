import { useMemo } from 'react'
import { Boxes, ClipboardCheck, AlertCircle, BookOpen } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/data-table'
import { EmptyState } from '@/core/ui/empty-state'
import { TableSkeleton } from '@/core/ui/skeleton'
import { formatCurrency } from '@/core/utils/format'
import { usePosVentas } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { getTodayStr } from '@/modules/pos-sync/cache-service'
import { useInventoryItems } from '../hooks/use-inventory-items'
import { useRecipes } from '../hooks/use-recipes'
import { useCounts } from '../hooks/use-counts'
import { computeStock, type ItemQtyMap } from '../domain/compute-stock'
import { computeConsumption, type ConsumptionSaleLine } from '../domain/compute-consumption'
import { explodeRecipe } from '../domain/explode-recipe'
import type { Recipe } from '../types'

interface StockTabProps {
  /** Navega a otro tab del módulo (Conteo / Recetas) desde los CTA. */
  onNavigate?: (tab: 'stock' | 'recipes' | 'ingredients' | 'count' | 'entries' | 'waste') => void
}

interface StockRow {
  id: string
  name: string
  category: string
  stockUnit: string
  level: number
  parLevel?: number
  belowPar: boolean
  mainProductName?: string
  servings?: number
}

/** Formatea un Date a 'YYYY-MM-DD' en hora local (mismo formato que getTodayStr). */
function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function StockTab({ onNavigate }: StockTabProps) {
  const { localIds } = useCompanyLocalIds()
  const localId = localIds[0]
  const { data: items, loading: itemsLoading } = useInventoryItems()
  const { data: recipes, loading: recLoading } = useRecipes()
  const { data: counts, loading: countsLoading } = useCounts()

  // Último conteo final = ancla de la proyección.
  const lastFinalCount = useMemo(() => {
    const finals = counts.filter((c) => c.status === 'final')
    if (finals.length === 0) return null
    return [...finals].sort((a, b) => b.countedAt.toMillis() - a.countedAt.toMillis())[0]
  }, [counts])

  const hasAnchor = lastFinalCount != null && localId != null
  const startDate = hasAnchor ? formatYMD(lastFinalCount.countedAt.toDate()) : ''
  const endDate = getTodayStr()

  // usePosVentas se llama SIEMPRE (regla de hooks); se desactiva con enabled/startDate.
  const {
    ventas,
    isPending: posPending,
    error: posError,
    rateLimited,
  } = usePosVentas({
    localIds: localId != null ? [localId] : [],
    startDate,
    endDate,
    enabled: hasAnchor,
  })

  const preparationsById = useMemo(() => {
    const map: Record<string, Recipe> = {}
    for (const r of recipes) if (r.type === 'preparation') map[r.id] = r
    return map
  }, [recipes])

  const recipeByPresentation = useMemo(() => {
    const map = new Map<string, Recipe>()
    for (const r of recipes) {
      if (r.type === 'product' && r.posProductKey) map.set(r.posProductKey.presentationId, r)
    }
    return map
  }, [recipes])

  // Producto principal por insumo = receta de producto que MÁS consume ese insumo por
  // porción (cuello de botella: agota el insumo más rápido). Heurística v1.
  const mainConsumerByItem = useMemo(() => {
    const map: Record<string, { name: string; perPortionQty: number }> = {}
    for (const recipe of recipeByPresentation.values()) {
      const perPortion = explodeRecipe({ recipe, preparationsById, portions: 1 })
      const name = recipe.posProductKey?.name ?? ''
      for (const [itemId, qty] of Object.entries(perPortion)) {
        if (qty <= 0) continue
        const prev = map[itemId]
        if (!prev || qty > prev.perPortionQty) map[itemId] = { name, perPortionQty: qty }
      }
    }
    return map
  }, [recipeByPresentation, preparationsById])

  // Ventas POS → líneas de consumo (filtra anuladas, parsea strings).
  const saleLines = useMemo<ConsumptionSaleLine[]>(() => {
    const lines: ConsumptionSaleLine[] = []
    for (const v of ventas) {
      if (v.estado_txt?.toLowerCase() === 'comprobante anulado') continue
      for (const it of v.detalle ?? []) {
        lines.push({
          presentationId: String(it.id_producto),
          productName: it.nombre_producto ?? '',
          qty: Number(it.cantidad_vendida) || 0,
          lineRevenue: Number(it.venta_total) || 0,
        })
      }
    }
    return lines
  }, [ventas])

  const { consumption, unmapped } = useMemo(
    () => computeConsumption({ saleLines, recipeByPresentation, preparationsById }),
    [saleLines, recipeByPresentation, preparationsById],
  )

  const anchor = useMemo<ItemQtyMap>(() => {
    const map: ItemQtyMap = {}
    if (lastFinalCount) for (const line of lastFinalCount.lines) map[line.itemId] = line.qty
    return map
  }, [lastFinalCount])

  const stock = useMemo(
    () => computeStock({ anchor, consumption }),
    [anchor, consumption],
  )

  const rows = useMemo<StockRow[]>(() => {
    const out: StockRow[] = []
    for (const item of items) {
      if (item.active === false) continue
      const level = stock[item.id] ?? anchor[item.id] ?? 0
      const belowPar = item.parLevel != null && level < item.parLevel
      const main = mainConsumerByItem[item.id]
      const servings =
        main && main.perPortionQty > 0 && level > 0 ? Math.floor(level / main.perPortionQty) : undefined
      out.push({
        id: item.id,
        name: item.name,
        category: item.category ?? '',
        stockUnit: item.stockUnit,
        level,
        parLevel: item.parLevel,
        belowPar,
        mainProductName: main?.name,
        servings: main ? (level > 0 ? servings : 0) : undefined,
      })
    }
    // Bajo par primero, luego por nombre.
    return out.sort((a, b) => {
      if (a.belowPar !== b.belowPar) return a.belowPar ? -1 : 1
      return a.name.localeCompare(b.name, 'es')
    })
  }, [items, stock, anchor, mainConsumerByItem])

  const columns: Column<StockRow>[] = [
    {
      key: 'name',
      header: 'Insumo',
      width: '2fr',
      primary: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-dark-graphite truncate">{r.name}</div>
          {r.category && <div className="text-caption text-mid-gray truncate">{r.category}</div>}
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Stock proyectado',
      width: '1.3fr',
      render: (r) => (
        <span className={r.belowPar ? 'text-negative-text font-medium' : 'text-graphite'}>
          {r.level.toLocaleString('es-CO', { maximumFractionDigits: 1 })} {r.stockUnit}
        </span>
      ),
    },
    {
      key: 'par',
      header: 'Par',
      width: '1fr',
      render: (r) =>
        r.parLevel != null ? (
          <span className="inline-flex items-center gap-2">
            {r.parLevel.toLocaleString('es-CO')} {r.stockUnit}
            {r.belowPar && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-negative-bg text-negative-text">
                Bajo par
              </span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'main',
      header: 'Producto principal',
      width: '1.4fr',
      render: (r) => (r.mainProductName ? <span className="truncate">{r.mainProductName}</span> : '—'),
    },
    {
      key: 'servings',
      header: 'Alcanza para',
      width: '1fr',
      render: (r) => (r.servings != null ? `≈ ${r.servings.toLocaleString('es-CO')} porc.` : '—'),
    },
  ]

  const loading = itemsLoading || recLoading || countsLoading || (hasAnchor && posPending)

  if (localId == null) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Sin local POS vinculado"
        description="No se encontró un local del POS para esta empresa. Verifica la conexión del POS para proyectar el stock."
      />
    )
  }

  if (!lastFinalCount) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ClipboardCheck size={40} strokeWidth={1} className="text-smoke mb-4" />
        <h3 className="text-subheading font-medium text-graphite mb-1">Sin conteo para anclar el stock</h3>
        <p className="text-body text-mid-gray mb-4">
          El stock se proyecta desde el último conteo físico. Crea un conteo final para empezar.
        </p>
        {onNavigate && (
          <button
            onClick={() => onNavigate('count')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
          >
            <ClipboardCheck size={16} strokeWidth={1.5} />
            Ir a Conteo
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-mid-gray">
        Proyectado desde el conteo del{' '}
        <span className="text-graphite font-medium">
          {lastFinalCount.countedAt.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>{' '}
        menos el consumo de las ventas hasta hoy.
      </p>

      {(posError || rateLimited) && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-4 py-3 text-body text-warning-text">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
          <span>
            {rateLimited
              ? 'El POS limitó las consultas; el consumo puede estar incompleto.'
              : `No se pudieron cargar todas las ventas: ${posError}. El stock mostrado es parcial.`}
          </span>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <TableSkeleton rows={6} columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Sin insumos activos"
          description="Crea insumos en la pestaña Insumos para ver su stock proyectado."
        />
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      {unmapped.length > 0 && (
        <div className="rounded-lg border border-border/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium bg-warning-bg text-warning-text">
              {unmapped.length} {unmapped.length === 1 ? 'producto sin receta' : 'productos sin receta'}
            </span>
            <span className="text-caption text-mid-gray">no descuentan stock</span>
          </div>
          <div className="divide-y divide-border/60">
            {unmapped.slice(0, 10).map((u) => (
              <div key={u.presentationId} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-body text-dark-graphite truncate">{u.productName || '(sin nombre)'}</span>
                <span className="text-caption text-mid-gray shrink-0">
                  {u.units.toLocaleString('es-CO')} und · {formatCurrency(u.revenue)}
                </span>
              </div>
            ))}
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('recipes')}
              className="inline-flex items-center gap-1.5 text-body text-graphite font-medium hover:underline"
            >
              <BookOpen size={14} strokeWidth={1.5} />
              Crear sus recetas en Recetas
            </button>
          )}
        </div>
      )}
    </div>
  )
}
