import { httpsCallable } from 'firebase/functions'
import { getAppFunctions } from '@/core/firebase/config'
import type { PosDominioData, PosVenta, PosProducto } from './types'

// En prod usamos un path relativo (`/api/pos`) que nginx en Oracle reenvía
// a la Cloud Function. Evita adblockers que bloquean `*.a.run.app`. En dev
// permitimos override via env var para probar contra la función directo.
const PROXY_URL = import.meta.env.PROD
  ? '/api/pos'
  : ((import.meta.env.VITE_POS_PROXY_URL as string) || '/api/pos')

export interface ServerReconcileStats {
  tenantId: string
  companyId: string
  localIds: number[]
  ventasFetched: number
  ventasWritten: number
  daysWritten: number
  skippedPartial: number
  rateLimited: boolean
  durationMs: number
  error?: string
}

export interface ServerReconcileResult {
  startDate: string
  endDate: string
  companiesProcessed: number
  ventasWritten: number
  totalDurationMs: number
  perCompany: ServerReconcileStats[]
}

// Dispara el cron de reconciliación server-side para una company. Usa la
// misma lógica del cron nocturno (functions/src/pos-reconcile.ts) pero
// dirigida a una sola empresa. Rate-limiteado server-side a 1 llamada cada
// 5 min por company.
export async function triggerServerReconcile(
  companyId: string,
  days = 32,
): Promise<ServerReconcileResult> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<{ companyId: string; days: number }, ServerReconcileResult>(
    functions,
    'posReconcileOnDemand',
  )
  const res = await fn({ companyId, days })
  return res.data
}

export interface RebuildMonthResult {
  month: string
  tenantId: string
  companyId: string
  localIds: number[]
  salesDocsDeleted: number
  ventasFetched: number
  ventasWritten: number
  daysWritten: number
  windowsProcessed: number
  rateLimited: boolean
  durationMs: number
  error?: string
}

// Purga y redescarga un mes completo con ventanas de 15 días. Tarda varios
// minutos según volumen (ej. Manila en un mes típico ~2-3 min). Solo admins
// de la company deberían invocarlo — la validación de auth+cooldown la hace
// el callable; la UI oculta el control para no-admins.
export async function rebuildCacheMonth(
  companyId: string,
  month: string,
): Promise<RebuildMonthResult> {
  const functions = await getAppFunctions()
  const fn = httpsCallable<{ companyId: string; month: string }, RebuildMonthResult>(
    functions,
    'posRebuildMonth',
  )
  const res = await fn({ companyId, month })
  return res.data
}

interface ProxyResponse<T> {
  success: boolean
  data: {
    tipo: number | string
    data: T
    mensajes: string[]
  }
  error?: string
}

export class PosRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PosRateLimitError'
  }
}

// Timeout defensivo para cualquier call individual al proxy POS. El POS puede
// quedarse "pensando" varios minutos si el tenant está saturado o encolando;
// sin timeout, el refresh del selector se clavaba hasta 3 min. 30s alcanza
// para cualquier página / dominio / batch razonable; si falla, el caller
// decide (los refresh en background dejan los valores del cache intactos).
const POS_FETCH_TIMEOUT_MS = 30_000

// Multi-tenant: el proxy recibe `companyId` para resolver el tenant POS
// correspondiente (token + domainId). Todos los métodos del `posService`
// exigen companyId — pasar null/undefined dispara error claro del proxy.
async function callProxy<T>(
  companyId: string,
  action: string,
  params?: Record<string, unknown>,
): Promise<{ data: T; mensajes: string[] }> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, companyId, params }),
    signal: AbortSignal.timeout(POS_FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  const json = (await res.json()) as ProxyResponse<T>
  if (!json.success) throw new Error(json.error || 'POS API error')

  // Check POS API-level errors (tipo !== 1)
  const tipo = Number(json.data.tipo)
  if (tipo !== 1) {
    const msg = json.data.mensajes?.join(', ') || `POS error tipo ${tipo}`
    if (msg.toLowerCase().includes('solicitud en ejecuci') || msg.toLowerCase().includes('esper')) {
      throw new PosRateLimitError(msg)
    }
    throw new Error(msg)
  }

  return { data: json.data.data, mensajes: json.data.mensajes }
}

const API_DELAY = 6000 // 6s between requests (API requires 5s cooldown)

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const posService = {
  getDominio: async (companyId: string) => {
    const { data } = await callProxy<PosDominioData>(companyId, 'dominio')
    return data
  },

  getVentas: async (companyId: string, localId: number, f1: string, f2: string) => {
    let pagina = 1
    const allVentas: PosVenta[] = []
    while (true) {
      if (pagina > 1) await wait(API_DELAY)
      const { data } = await callProxy<Record<string, PosVenta> | PosVenta[]>(companyId, 'ventas', {
        local_id: localId, f1, f2, pagina,
      })
      const page = Array.isArray(data) ? data : Object.values(data)
      if (page.length === 0) break
      allVentas.push(...page)
      pagina++
    }
    return allVentas
  },

  getVentasBatch: async (companyId: string, localIds: number[], f1: string, f2: string) => {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ventas-batch',
        companyId,
        params: { local_ids: localIds, f1, f2 },
      }),
      signal: AbortSignal.timeout(POS_FETCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const json = (await res.json()) as {
      success: boolean
      data: { ventas: PosVenta[]; rateLimited: boolean; endpoint: string }
      error?: string
    }
    if (!json.success) {
      const msg = json.error || 'POS API error'
      if (msg.toLowerCase().includes('solicitud en ejecuci') || msg.toLowerCase().includes('esper')) {
        throw new PosRateLimitError(msg)
      }
      throw new Error(msg)
    }

    return json.data
  },

  getCatalogo: async (companyId: string, localId: number) => {
    const { data } = await callProxy<PosProducto[]>(companyId, 'catalogo', { local_id: localId })
    return (Array.isArray(data) ? data : Object.values(data)) as PosProducto[]
  },
}
