import { tool } from 'ai'
import { z } from 'zod'
import { db } from '../firestore.js'
import { SALES_COLLECTION, META_COLLECTION } from '../pos-cache.js'

const CATALOG_COLLECTION = 'pos-catalog-cache'

interface PosProductoLite {
  productogeneral_id?: number | string
  productogeneral_descripcion?: string
  categoria_id?: number | string
  categoria_descripcion?: string
  productogeneral_urlimagen?: string | null
  lista_presentacion?: Array<{
    producto_id?: number | string
    producto_presentacion?: string
    producto_precio?: number | string
  }>
  listaModificadores?: Array<{ modificadorseleccion_nombre?: string }>
  [key: string]: unknown
}

function formatProduct(p: PosProductoLite) {
  const presentaciones = Array.isArray(p.lista_presentacion) ? p.lista_presentacion : []
  const prices = presentaciones.map((x) => num(x.producto_precio)).filter((x) => x > 0)
  return {
    id: p.productogeneral_id,
    name: p.productogeneral_descripcion,
    category: p.categoria_descripcion,
    presentaciones: presentaciones.map((x) => ({
      id: x.producto_id,
      name: x.producto_presentacion,
      price: num(x.producto_precio),
    })),
    priceRange: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    modifierCount: Array.isArray(p.listaModificadores) ? p.listaModificadores.length : 0,
  }
}

interface PosVentaLite {
  fecha?: string
  id_local?: number | string
  total?: string | number
  descuento?: string | number
  tipo_pago?: string
  detalle?: Array<Record<string, unknown>>
  pagosList?: Array<Record<string, unknown>>
  lista_propinas?: Array<{ montoConIgv?: string | number; tipoPago?: string }>
  [key: string]: unknown
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? parseFloat(v) : Number(v)
  return Number.isFinite(n) ? n : 0
}

// Lee todos los docs de `pos-sales-cache` en rango y aplana el array de ventas.
// Un doc = (date, localId, page) con hasta 150 ventas.
async function fetchSalesInRange(
  companyId: string,
  startDate: string,
  endDate: string,
  localId?: number,
): Promise<PosVentaLite[]> {
  const snap = await db
    .collection('companies')
    .doc(companyId)
    .collection(SALES_COLLECTION)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get()

  const ventas: PosVentaLite[] = []
  for (const doc of snap.docs) {
    const data = doc.data() as { localId?: number | string; ventas?: PosVentaLite[] }
    if (localId !== undefined && String(data.localId) !== String(localId)) continue
    if (Array.isArray(data.ventas)) ventas.push(...data.ventas)
  }
  return ventas
}

function dateFromFecha(fecha: string | undefined): string | null {
  if (!fecha) return null
  // Formato POS típico: "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD".
  return fecha.slice(0, 10)
}

export function createPosTools(companyId: string) {
  return {
    getPosSales: tool({
      description:
        'Obtiene las ventas del POS en un rango de fechas con agregación por día: total vendido, cantidad de ventas y ticket promedio. Puede filtrar por local.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
        localId: z.number().optional().describe('ID del local a filtrar (opcional)'),
      }),
      execute: async ({ startDate, endDate, localId }) => {
        const ventas = await fetchSalesInRange(companyId, startDate, endDate, localId)
        const byDay = new Map<string, { total: number; count: number }>()
        let totalRevenue = 0
        for (const v of ventas) {
          const day = dateFromFecha(v.fecha)
          if (!day) continue
          const total = num(v.total)
          totalRevenue += total
          const entry = byDay.get(day) ?? { total: 0, count: 0 }
          entry.total += total
          entry.count += 1
          byDay.set(day, entry)
        }
        const days = Array.from(byDay.entries())
          .map(([date, { total, count }]) => ({
            date,
            total,
            count,
            avgTicket: count > 0 ? Math.round(total / count) : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
        return {
          dateRange: { startDate, endDate },
          localId: localId ?? 'all',
          totalSales: ventas.length,
          totalRevenue,
          avgTicket: ventas.length > 0 ? Math.round(totalRevenue / ventas.length) : 0,
          daysWithSales: days.length,
          byDay: days,
        }
      },
    }),

    getSalesByPaymentMethod: tool({
      description:
        'Desglosa las ventas del POS por método de pago (AP, QR, datáfono, efectivo, Rappi, etc.) en un rango de fechas. Suma los montos de `pagosList` de cada venta.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
      }),
      execute: async ({ startDate, endDate }) => {
        const ventas = await fetchSalesInRange(companyId, startDate, endDate)
        const byMethod = new Map<string, { total: number; count: number }>()
        let grandTotal = 0
        for (const v of ventas) {
          const pagos = Array.isArray(v.pagosList) ? v.pagosList : []
          if (pagos.length === 0) {
            // Fallback: usa `tipo_pago` y `total` si no viene pagosList
            const method = String(v.tipo_pago ?? 'desconocido')
            const total = num(v.total)
            grandTotal += total
            const entry = byMethod.get(method) ?? { total: 0, count: 0 }
            entry.total += total
            entry.count += 1
            byMethod.set(method, entry)
            continue
          }
          for (const p of pagos) {
            const method = String(p.tipoPago ?? 'desconocido')
            const monto = num(p.monto)
            grandTotal += monto
            const entry = byMethod.get(method) ?? { total: 0, count: 0 }
            entry.total += monto
            entry.count += 1
            byMethod.set(method, entry)
          }
        }
        const methods = Array.from(byMethod.entries())
          .map(([method, { total, count }]) => ({
            method,
            total,
            count,
            percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100 * 100) / 100 : 0,
          }))
          .sort((a, b) => b.total - a.total)
        return {
          dateRange: { startDate, endDate },
          totalRevenue: grandTotal,
          ventasCount: ventas.length,
          byPaymentMethod: methods,
        }
      },
    }),

    getTopProducts: tool({
      description:
        'Lista los productos más vendidos del POS en un rango de fechas, agregados por unidades vendidas y valor total.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
        limit: z.number().optional().default(10).describe('Cantidad de productos top (default: 10)'),
      }),
      execute: async ({ startDate, endDate, limit }) => {
        const ventas = await fetchSalesInRange(companyId, startDate, endDate)
        const byProduct = new Map<string, { units: number; revenue: number; category: string }>()
        for (const v of ventas) {
          const detalle = Array.isArray(v.detalle) ? v.detalle : []
          for (const item of detalle) {
            const name = String(item.nombre_producto ?? 'Sin nombre')
            const category = String(item.categoria_descripcion ?? 'Sin categoría')
            const units = num(item.cantidad_vendida)
            const revenue = num(item.venta_total)
            const entry = byProduct.get(name) ?? { units: 0, revenue: 0, category }
            entry.units += units
            entry.revenue += revenue
            byProduct.set(name, entry)
          }
        }
        const top = Array.from(byProduct.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.units - a.units)
          .slice(0, limit)
        return {
          dateRange: { startDate, endDate },
          uniqueProducts: byProduct.size,
          topProducts: top,
        }
      },
    }),

    getSalesByLocation: tool({
      description: 'Desglosa las ventas del POS por local en un rango de fechas.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
      }),
      execute: async ({ startDate, endDate }) => {
        const ventas = await fetchSalesInRange(companyId, startDate, endDate)
        const byLocal = new Map<string, { total: number; count: number }>()
        let grandTotal = 0
        for (const v of ventas) {
          const localId = String(v.id_local ?? 'desconocido')
          const total = num(v.total)
          grandTotal += total
          const entry = byLocal.get(localId) ?? { total: 0, count: 0 }
          entry.total += total
          entry.count += 1
          byLocal.set(localId, entry)
        }
        const locations = Array.from(byLocal.entries())
          .map(([localId, { total, count }]) => ({
            localId,
            total,
            count,
            avgTicket: count > 0 ? Math.round(total / count) : 0,
            percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100 * 100) / 100 : 0,
          }))
          .sort((a, b) => b.total - a.total)
        return {
          dateRange: { startDate, endDate },
          totalRevenue: grandTotal,
          ventasCount: ventas.length,
          byLocation: locations,
        }
      },
    }),

    getPosSyncStatus: tool({
      description:
        'Estado de sincronización del POS: última fecha con datos, huecos recientes, total de meses cacheados.',
      parameters: z.object({}),
      execute: async () => {
        const metaSnap = await db
          .collection('companies')
          .doc(companyId)
          .collection(META_COLLECTION)
          .get()
        const months = metaSnap.docs.map((d) => d.id).sort()
        // Última fecha con al menos un día registrado
        let lastDate: string | null = null
        const allDays: string[] = []
        for (const d of metaSnap.docs) {
          const data = d.data() as { days?: Record<string, unknown> }
          const keys = Object.keys(data.days ?? {})
          for (const k of keys) {
            const day = k.split('_')[0]
            allDays.push(day)
            if (!lastDate || day > lastDate) lastDate = day
          }
        }
        // Huecos en los últimos 14 días
        const now = new Date()
        const recent: string[] = []
        for (let i = 0; i < 14; i++) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          recent.push(d.toISOString().split('T')[0])
        }
        const present = new Set(allDays)
        const gaps = recent.filter((d) => !present.has(d))
        return {
          monthsCached: months.length,
          firstMonth: months[0] ?? null,
          lastMonth: months[months.length - 1] ?? null,
          lastDateWithData: lastDate,
          gapsInLast14Days: gaps,
        }
      },
    }),

    getPosCatalog: tool({
      description:
        'Obtiene el catálogo de productos del POS (menú maestro con presentaciones, precios de lista y modificadores). Si se provee localId, retorna solo ese local; si no, agrega los catálogos de todos los locales disponibles. Devuelve un resumen con categorías y conteos, además de los productos formateados.',
      parameters: z.object({
        localId: z.number().optional().describe('ID del local (opcional). Si se omite, agrega todos los locales.'),
        category: z.string().optional().describe('Filtrar por categoría'),
        limit: z.number().optional().default(50).describe('Máximo de productos a devolver (default: 50)'),
      }),
      execute: async ({ localId, category, limit }) => {
        const ref = db.collection('companies').doc(companyId).collection(CATALOG_COLLECTION)
        const snap = localId !== undefined ? await ref.doc(String(localId)).get().then((d) => (d.exists ? [d] : [])) : (await ref.get()).docs
        if (snap.length === 0) {
          return { found: false, message: 'No hay catálogo cacheado. Sincroniza el catálogo desde el módulo POS Sync.' }
        }
        const byId = new Map<string, PosProductoLite>()
        let latestSync: string | null = null
        for (const d of snap) {
          const data = d.data() as { productos?: PosProductoLite[]; syncedAt?: { toDate?: () => Date } }
          const syncedAt = data.syncedAt?.toDate?.().toISOString() ?? null
          if (syncedAt && (!latestSync || syncedAt > latestSync)) latestSync = syncedAt
          for (const p of data.productos ?? []) {
            const key = String(p.productogeneral_id)
            if (!byId.has(key)) byId.set(key, p)
          }
        }
        let products = Array.from(byId.values())
        if (category) {
          const needle = category.toLowerCase()
          products = products.filter((p) => String(p.categoria_descripcion ?? '').toLowerCase().includes(needle))
        }
        const byCategory = products.reduce<Record<string, number>>((acc, p) => {
          const cat = String(p.categoria_descripcion ?? 'Sin categoría')
          acc[cat] = (acc[cat] ?? 0) + 1
          return acc
        }, {})
        const formatted = products.slice(0, limit).map(formatProduct)
        return {
          found: true,
          localId: localId ?? 'all',
          syncedAt: latestSync,
          totalProducts: products.length,
          returnedProducts: formatted.length,
          byCategory,
          products: formatted,
        }
      },
    }),

    searchPosProduct: tool({
      description: 'Busca productos en el catálogo del POS por nombre (parcial, case-insensitive). Útil para preguntas como "¿tenemos X en el menú?", "¿cuánto cuesta el Y?"',
      parameters: z.object({
        query: z.string().describe('Término de búsqueda (coincide con descripción del producto)'),
        limit: z.number().optional().default(20).describe('Máximo de resultados (default: 20)'),
      }),
      execute: async ({ query, limit }) => {
        const snap = await db.collection('companies').doc(companyId).collection(CATALOG_COLLECTION).get()
        if (snap.empty) {
          return { found: false, message: 'No hay catálogo cacheado. Sincroniza el catálogo desde el módulo POS Sync.' }
        }
        const needle = query.toLowerCase()
        const byId = new Map<string, PosProductoLite>()
        for (const d of snap.docs) {
          const data = d.data() as { productos?: PosProductoLite[] }
          for (const p of data.productos ?? []) {
            const name = String(p.productogeneral_descripcion ?? '').toLowerCase()
            if (!name.includes(needle)) continue
            const key = String(p.productogeneral_id)
            if (!byId.has(key)) byId.set(key, p)
          }
        }
        const matches = Array.from(byId.values()).slice(0, limit).map(formatProduct)
        return {
          query,
          matchCount: byId.size,
          returned: matches.length,
          products: matches,
        }
      },
    }),

    getProductsWithoutSales: tool({
      description:
        'Lista productos del catálogo que NO tuvieron ventas en el rango indicado (útil para detectar productos inactivos o sin rotación). Cruza el catálogo contra los detalles de ventas.',
      parameters: z.object({
        startDate: z.string().describe('Fecha inicio (YYYY-MM-DD)'),
        endDate: z.string().describe('Fecha fin (YYYY-MM-DD)'),
        limit: z.number().optional().default(30).describe('Máximo de productos a listar (default: 30)'),
      }),
      execute: async ({ startDate, endDate, limit }) => {
        // Catálogo: productos únicos por productogeneral_id
        const catSnap = await db.collection('companies').doc(companyId).collection(CATALOG_COLLECTION).get()
        if (catSnap.empty) {
          return { found: false, message: 'No hay catálogo cacheado. Sincroniza el catálogo desde el módulo POS Sync.' }
        }
        const catalogById = new Map<string, PosProductoLite>()
        for (const d of catSnap.docs) {
          const data = d.data() as { productos?: PosProductoLite[] }
          for (const p of data.productos ?? []) {
            const key = String(p.productogeneral_id)
            if (!catalogById.has(key)) catalogById.set(key, p)
          }
        }
        // Ventas en rango — colectar ids vendidos (de detalle.id_producto se mapea a presentación; usamos nombre como fallback)
        const ventas = await fetchSalesInRange(companyId, startDate, endDate)
        const soldNames = new Set<string>()
        for (const v of ventas) {
          const detalle = Array.isArray(v.detalle) ? v.detalle : []
          for (const item of detalle) {
            const name = String(item.nombre_producto ?? '').trim().toLowerCase()
            if (name) soldNames.add(name)
          }
        }
        const withoutSales = Array.from(catalogById.values()).filter((p) => {
          const name = String(p.productogeneral_descripcion ?? '').trim().toLowerCase()
          return name && !soldNames.has(name)
        })
        return {
          dateRange: { startDate, endDate },
          catalogSize: catalogById.size,
          soldUnique: soldNames.size,
          withoutSalesCount: withoutSales.length,
          products: withoutSales.slice(0, limit).map(formatProduct),
        }
      },
    }),

    triggerPosReconcile: tool({
      description:
        'Dispara una reconciliación del POS (descarga ventas recientes al caché). Requiere confirmación del usuario. Por defecto reconcilia los últimos 7 días.',
      parameters: z.object({
        days: z.number().optional().default(7).describe('Cantidad de días a reconciliar (default: 7, máx 32)'),
      }),
    }),
  }
}
