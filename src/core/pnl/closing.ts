// El documento de cierre mensual: todo lo que un humano captura y que no vive
// ni en Ecore ni en el POS.
//
// Hasta ahora esto eran constantes dentro de scripts/informe-mensual-negocios.mjs
// (MANUAL_ADJUSTMENTS, INGRESOS_NO_OPERACIONALES, INGRESOS_NO_RECIBIDOS,
// VENTAS_MANUALES), asi que cerrar el mes exigia editar codigo. Ahora viven en
// companies/{id}/pnl-closings/{ym} y se capturan desde /informes.
//
// El esquema se valida con zod en los DOS lados: la app al guardar y el
// generador al leer. Si alguien escribe basura a mano en Firestore, el cierre
// falla ruidoso en vez de meter un numero silenciosamente raro en el P&L.

import { z } from 'zod'

/** Monto en pesos. Puede ser negativo: hay contra-asientos de reparto. */
const money = z.number().finite()

/**
 * Un ajuste que no viene de Ecore. `accrued` y `paid` pueden diferir (una
 * provision devenga sin haber salido de caja) y pueden ser negativos.
 *
 * `origin: 'bank'` marca los derivados del extracto (4x1000, costos bancarios,
 * comisiones). La UI los muestra con candado y el boton "Traer del extracto"
 * sólo toca esos, nunca pisa un 'manual'.
 */
export const manualItemSchema = z.object({
  id: z.string().min(1),
  line: z.string().min(1),
  concept: z.string().default(''),
  accrued: money.default(0),
  paid: money.default(0),
  origin: z.enum(['manual', 'bank']).default('manual'),
  bucket: z.string().optional(),
  statementIds: z.array(z.string()).optional(),
  note: z.string().optional(),
})

export const incomeNotReceivedSchema = z.object({
  id: z.string().min(1),
  concept: z.string().default(''),
  amount: money.default(0),
  note: z.string().optional(),
})

/**
 * Venta de una sede sin POS conectado. Mismo shape que tenia VENTAS_MANUALES,
 * para que migrar sea copiar. Con `perDay` la sede queda tan completa como las
 * conectadas (canal, impoconsumo, tickets y serie dia a dia).
 */
export const salesOverrideSchema = z.object({
  total: money,
  delivery: money.optional(),
  impoconsumo: money.optional(),
  tickets: z.number().int().nonnegative().optional(),
  propinas: money.optional(),
  note: z.string().default(''),
  perDay: z.record(z.string(), z.object({
    total: money,
    tickets: z.number().int().nonnegative().default(0),
  })).optional(),
})

export const closingSchema = z.object({
  ym: z.string().regex(/^\d{4}-\d{2}$/),
  // draft: se esta capturando · ready: revisado · closed: el Excel ya salio.
  status: z.enum(['draft', 'ready', 'closed']).default('draft'),
  manualAdjustments: z.object({
    /** De donde salieron las cifras ("Extracto bancario de agosto 2026"). */
    source: z.string().default(''),
    items: z.array(manualItemSchema).default([]),
  }).default({ source: '', items: [] }),
  nonOperatingIncome: z.array(manualItemSchema).default([]),
  incomeNotReceived: z.array(incomeNotReceivedSchema).default([]),
  salesOverride: salesOverrideSchema.nullish(),
  createdBy: z.string().optional(),
  closedBy: z.string().optional(),
  schemaVersion: z.literal(1).default(1),
})

export type ClosingManualItem = z.infer<typeof manualItemSchema>
export type ClosingIncomeNotReceived = z.infer<typeof incomeNotReceivedSchema>
export type ClosingSalesOverride = z.infer<typeof salesOverrideSchema>
export type ClosingDoc = z.infer<typeof closingSchema>

export const CLOSINGS_COLLECTION = 'pnl-closings'
export const SNAPSHOTS_COLLECTION = 'pnl-snapshots'
export const DEFERRALS_COLLECTION = 'pnl-deferrals'

export function emptyClosing(ym: string): ClosingDoc {
  return closingSchema.parse({ ym })
}

/**
 * Lee un doc crudo de Firestore. Devuelve null si no hay nada que leer, y lanza
 * si el contenido no cumple el esquema — un cierre con datos corruptos tiene
 * que fallar, no producir un P&L plausible pero equivocado.
 *
 * Los Timestamp de createdAt/updatedAt se ignoran: no entran al calculo.
 */
export function parseClosing(raw: unknown, ym: string): ClosingDoc | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const { createdAt: _c, updatedAt: _u, closedAt: _x, ...rest } = src
  return closingSchema.parse({ ...rest, ym })
}

/** True si el cierre no tiene nada capturado: sirve para caer al fallback. */
export function isEmptyClosing(c: ClosingDoc | null): boolean {
  if (!c) return true
  return c.manualAdjustments.items.length === 0
    && c.nonOperatingIncome.length === 0
    && c.incomeNotReceived.length === 0
    && !c.salesOverride
}
