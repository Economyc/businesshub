import { useMemo } from 'react'
import { useStockSync } from '@/modules/pos-sync/hooks'
import { useCompanyLocalIds } from '@/modules/pos-sync/company-mapping'
import { getTodayStr } from '@/modules/pos-sync/cache-service'
import { useInventoryItems } from './use-inventory-items'
import { useRecipes } from './use-recipes'
import { useCounts } from './use-counts'
import { useReceipts } from './use-receipts'
import { useAdjustments } from './use-adjustments'
import { computeStock, type ItemQtyMap } from '../domain/compute-stock'
import {
  computeConsumption,
  type ConsumptionSaleLine,
  type UnmappedSale,
} from '../domain/compute-consumption'
import { aggregateReceipts, aggregateAdjustments, type FactorByItem } from '../domain/aggregate-movements'
import type { InventoryCount, InventoryItem, Recipe } from '../types'

/** Formatea un Date a 'YYYY-MM-DD' en hora local (mismo formato que getTodayStr). */
function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface UseProjectedStockResult {
  /** Stock proyectado por insumo (unidad de stock). */
  stock: ItemQtyMap
  /** Cantidades del último conteo final (ancla de la proyección). */
  anchor: ItemQtyMap
  /** Último conteo final = ancla. null si no hay ninguno. */
  lastFinalCount: InventoryCount | null
  items: InventoryItem[]
  recipes: Recipe[]
  preparationsById: Record<string, Recipe>
  /** Productos vendidos sin receta (no descuentan stock). */
  unmapped: UnmappedSale[]
  /** Local POS de la company activa. null si no hay match. */
  localId: number | null
  /** Hay ancla (conteo final) y local POS → la proyección es significativa. */
  hasAnchor: boolean
  loading: boolean
  // Estado de sincronización del consumo POS (cache consolidado).
  syncing: boolean
  missingDays: number
  lastSyncedAt: Date | null
  failedPersistently: boolean
  syncNow: () => void
}

/**
 * Proyección de stock por insumo: `anchor (último conteo final) + entradas −
 * ajustes − consumo (ventas POS × recetas)`. Extrae el pipeline que antes vivía
 * inline en stock-tab para reutilizarlo desde el panel de diferencias del conteo.
 *
 * v1: proyecta hasta hoy (getTodayStr). Los conteos se hacen el mismo día, así que
 * comparar lo contado contra la proyección de hoy es correcto.
 */
export function useProjectedStock(): UseProjectedStockResult {
  const { localIds } = useCompanyLocalIds()
  const localId = localIds[0] ?? null
  const { data: items, loading: itemsLoading } = useInventoryItems()
  const { data: recipes, loading: recLoading } = useRecipes()
  const { data: counts, loading: countsLoading } = useCounts()
  const { data: receipts } = useReceipts()
  const { data: adjustments } = useAdjustments()

  // Último conteo final = ancla de la proyección.
  const lastFinalCount = useMemo(() => {
    const finals = counts.filter((c) => c.status === 'final')
    if (finals.length === 0) return null
    return [...finals].sort((a, b) => b.countedAt.toMillis() - a.countedAt.toMillis())[0]
  }, [counts])

  const hasAnchor = lastFinalCount != null && localId != null
  const startDate = hasAnchor ? formatYMD(lastFinalCount!.countedAt.toDate()) : ''
  const endDate = getTodayStr()

  // El Stock NO consulta el POS en vivo (eso rate-limitea por concurrencia de
  // token). Lee el consumo del cache consolidado y deja que el server lo llene
  // (useStockSync). Se llama SIEMPRE (regla de hooks); se desactiva con enabled.
  const {
    ventas,
    loading: posPending,
    syncing,
    missingDays,
    lastSyncedAt,
    failedPersistently,
    syncNow,
  } = useStockSync({
    localId: localId ?? null,
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

  // Momento exacto del conteo ancla. Solo descontamos ventas POSTERIORES a este
  // instante: lo contado ya refleja las ventas previas del día (contar 10 cocas a
  // las 5pm ya incluye lo vendido en la mañana). Sin esto se descontaban dos veces
  // y el stock daba negativo el mismo día del conteo.
  const anchorMillis = lastFinalCount ? lastFinalCount.countedAt.toMillis() : 0

  // Ventas POS → líneas de consumo (filtra anuladas, descarta las previas al
  // conteo, parsea strings).
  const saleLines = useMemo<ConsumptionSaleLine[]>(() => {
    const lines: ConsumptionSaleLine[] = []
    for (const v of ventas) {
      if (v.estado_txt?.toLowerCase() === 'comprobante anulado') continue
      // v.fecha viene como 'YYYY-MM-DD HH:mm:ss' en hora local (Colombia, igual que
      // el navegador). Las ventas en el mismo momento o anteriores al conteo ya
      // están reflejadas en lo contado → no se descuentan.
      if (anchorMillis) {
        const ventaMs = new Date(v.fecha.replace(' ', 'T')).getTime()
        if (Number.isFinite(ventaMs) && ventaMs <= anchorMillis) continue
      }
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
  }, [ventas, anchorMillis])

  const { consumption, unmapped } = useMemo(
    () => computeConsumption({ saleLines, recipeByPresentation, preparationsById }),
    [saleLines, recipeByPresentation, preparationsById],
  )

  const anchor = useMemo<ItemQtyMap>(() => {
    const map: ItemQtyMap = {}
    if (lastFinalCount) for (const line of lastFinalCount.lines) map[line.itemId] = line.qty
    return map
  }, [lastFinalCount])

  // Entradas y mermas posteriores al conteo ancla. Las entradas se convierten de
  // unidad de compra a stock con el factor de cada insumo.
  const factorByItem = useMemo<FactorByItem>(() => {
    const map: FactorByItem = {}
    for (const it of items) map[it.id] = it.purchaseToStockFactor
    return map
  }, [items])

  const sinceMillis = lastFinalCount ? lastFinalCount.countedAt.toMillis() : 0

  const receiptsMap = useMemo<ItemQtyMap>(
    () => aggregateReceipts(receipts, factorByItem, sinceMillis),
    [receipts, factorByItem, sinceMillis],
  )

  const adjustmentsMap = useMemo<ItemQtyMap>(
    () => aggregateAdjustments(adjustments, sinceMillis),
    [adjustments, sinceMillis],
  )

  const stock = useMemo(
    () => computeStock({ anchor, receipts: receiptsMap, adjustments: adjustmentsMap, consumption }),
    [anchor, receiptsMap, adjustmentsMap, consumption],
  )

  const loading = itemsLoading || recLoading || countsLoading || (hasAnchor && posPending)

  return {
    stock,
    anchor,
    lastFinalCount,
    items,
    recipes,
    preparationsById,
    unmapped,
    localId,
    hasAnchor,
    loading,
    syncing,
    missingDays,
    lastSyncedAt,
    failedPersistently,
    syncNow,
  }
}
