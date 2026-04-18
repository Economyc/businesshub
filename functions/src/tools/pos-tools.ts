import { tool } from 'ai'
import { z } from 'zod'
import { db } from '../firestore.js'
import { SALES_COLLECTION, META_COLLECTION } from '../pos-cache.js'

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

    triggerPosReconcile: tool({
      description:
        'Dispara una reconciliación del POS (descarga ventas recientes al caché). Requiere confirmación del usuario. Por defecto reconcilia los últimos 7 días.',
      parameters: z.object({
        days: z.number().optional().default(7).describe('Cantidad de días a reconciliar (default: 7, máx 32)'),
      }),
    }),
  }
}
