// Cliente HTTP reusable contra el POS de restaurant.pe.
// Lo usan tanto `pos-proxy` (expone HTTP al browser) como `pos-reconcile`
// (cron nocturno que hidrata cache server-side). Toda comunicación con el POS
// debe pasar por aquí para mantener un único lugar con el rate-limit, retries
// y manejo de "tipo !== 1" — el POS entrega errores y rate-limits dentro del
// body con status 200, así que no basta con revisar `res.ok`.

export const POS_BASE_URL = 'http://api.restaurant.pe/restaurant'
export const POS_DOMAIN_ID = '8267'

export const BATCH_DELAY_MS = 5000
export const MAX_RETRIES = 3

export interface PosApiResponse {
  tipo: number | string
  data: Record<string, unknown> | unknown[]
  mensajes: string[]
}

export interface PosLocalRaw {
  local_id: string | number
  local_descripcion: string
  [key: string]: unknown
}

export interface PosDominioResult {
  locales: PosLocalRaw[]
  [key: string]: unknown
}

export function buildUrl(path: string, token: string): string {
  return `${POS_BASE_URL}${path}?token=${token.trim()}`
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchPosApi(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<unknown> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body && method === 'POST') {
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(url, opts)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POS API error ${res.status}: ${text}`)
  }
  return res.json()
}

export function isRateLimited(response: PosApiResponse): boolean {
  const msg = (response.mensajes || []).join(' ').toLowerCase()
  return msg.includes('solicitud en ejecuci') || msg.includes('esper')
}

export function extractVentas(response: PosApiResponse): unknown[] {
  const d = response.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') return Object.values(d)
  return []
}

export async function fetchDominio(token: string): Promise<PosDominioResult> {
  const url = buildUrl(
    `/readonly/rest/delivery/obtenerInformacionDominio/${POS_DOMAIN_ID}`,
    token,
  )
  const raw = (await fetchPosApi(url)) as PosApiResponse
  const tipo = Number(raw.tipo)
  if (tipo !== 1) {
    const msg = (raw.mensajes || []).join(', ') || `POS error tipo ${tipo}`
    throw new Error(msg)
  }
  const data = raw.data as Record<string, unknown>
  const locales = Array.isArray(data?.locales) ? (data.locales as PosLocalRaw[]) : []
  return { ...data, locales }
}

export interface FetchAllPagesResult {
  ventas: unknown[]
  rateLimited: boolean
  requestCount: number
}

// Pagina `obtenerVentasPorIntegracion` para un local en el rango [f1, f2].
// El POS cooldownea ~5s entre requests al mismo token; si nos dice "solicitud
// en ejecución" reintentamos hasta MAX_RETRIES esperando BATCH_DELAY_MS.
export async function fetchAllPagesForLocal(
  token: string,
  localId: number,
  f1: string,
  f2: string,
): Promise<FetchAllPagesResult> {
  const endpointPath = `/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`
  const ventas: unknown[] = []
  let pagina = 1
  let requestCount = 0

  while (true) {
    let response: PosApiResponse | null = null
    let succeeded = false

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await delay(BATCH_DELAY_MS)
      }

      const url = buildUrl(endpointPath, token)
      response = (await fetchPosApi(url, 'POST', {
        local_id: localId,
        f1,
        f2,
        pagina,
        incluirNotasVenta: 1,
      })) as PosApiResponse
      requestCount++

      if (isRateLimited(response)) {
        continue
      }

      succeeded = true
      break
    }

    if (!succeeded) {
      return { ventas, rateLimited: true, requestCount }
    }

    const tipo = Number(response!.tipo)

    if (tipo !== 1) {
      if (pagina === 1) {
        const msg = (response!.mensajes || []).join(', ') || `POS error tipo ${tipo}`
        throw new Error(msg)
      }
      break
    }

    const pageVentas = extractVentas(response!)
    if (pageVentas.length === 0) break

    ventas.push(...pageVentas)
    pagina++
  }

  return { ventas, rateLimited: false, requestCount }
}

export async function fetchCatalogo(token: string, localId: number): Promise<unknown[]> {
  const url = buildUrl(
    `/readonly/rest/delivery/obtenerCartaPorLocal/${POS_DOMAIN_ID}/${localId}`,
    token,
  )
  const raw = (await fetchPosApi(url)) as PosApiResponse
  const tipo = Number(raw.tipo)
  if (tipo !== 1) {
    const msg = (raw.mensajes || []).join(', ') || `POS error tipo ${tipo}`
    throw new Error(msg)
  }
  const d = raw.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') return Object.values(d)
  return []
}
