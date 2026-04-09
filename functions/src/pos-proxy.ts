import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

const posToken = defineSecret('POS_TOKEN')

const POS_BASE_URL = 'http://api.restaurant.pe/restaurant'
const POS_DOMAIN_ID = '8267'

type PosAction = 'ventas' | 'ventas-batch' | 'catalogo' | 'dominio'

interface PosProxyRequest {
  action: PosAction
  params?: {
    local_id?: number
    local_ids?: number[]
    f1?: string
    f2?: string
    pagina?: number
  }
}

function buildUrl(path: string, token: string): string {
  return `${POS_BASE_URL}${path}?token=${token.trim()}`
}

async function fetchPosApi(url: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
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

const BATCH_DELAY = 6000 // 6s between API requests (5s cooldown)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface PosApiResponse {
  tipo: number | string
  data: Record<string, unknown> | unknown[]
  mensajes: string[]
}

function isRateLimited(response: PosApiResponse): boolean {
  const msg = (response.mensajes || []).join(' ').toLowerCase()
  return msg.includes('solicitud en ejecuci') || msg.includes('espere')
}

function extractVentas(response: PosApiResponse): unknown[] {
  const d = response.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') return Object.values(d)
  return []
}

async function fetchAllPagesForLocal(
  token: string,
  endpointPath: string,
  localId: number,
  f1: string,
  f2: string,
  needsDelay: boolean
): Promise<{ ventas: unknown[]; rateLimited: boolean; requestCount: number }> {
  const ventas: unknown[] = []
  let pagina = 1
  let requestCount = 0

  while (true) {
    if (needsDelay || pagina > 1) {
      await delay(BATCH_DELAY)
    }

    const url = buildUrl(endpointPath, token)
    const response = (await fetchPosApi(url, 'POST', {
      local_id: localId, f1, f2, pagina,
    })) as PosApiResponse
    requestCount++

    const tipo = Number(response.tipo)

    if (tipo !== 1) {
      if (isRateLimited(response)) {
        return { ventas, rateLimited: true, requestCount }
      }
      // Non-rate-limit error on first page: propagate so caller can decide to fallback
      if (pagina === 1) {
        const msg = (response.mensajes || []).join(', ') || `POS error tipo ${tipo}`
        throw new Error(msg)
      }
      // Error on later pages: stop pagination for this local, keep what we have
      break
    }

    const pageVentas = extractVentas(response)
    if (pageVentas.length === 0) break

    ventas.push(...pageVentas)
    pagina++
  }

  return { ventas, rateLimited: false, requestCount }
}

async function fetchVentasBatch(
  token: string,
  localIds: number[],
  f1: string,
  f2: string
): Promise<{ ventas: unknown[]; rateLimited: boolean; endpoint: string }> {
  const primaryPath = `/readonly/rest/venta/obtenerVentasPorLocal/${POS_DOMAIN_ID}`
  const fallbackPath = `/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`

  // Determine which endpoint to use by testing the first local
  let endpointPath = primaryPath
  let endpointUsed = 'obtenerVentasPorLocal'

  try {
    const firstResult = await fetchAllPagesForLocal(token, primaryPath, localIds[0], f1, f2, false)
    if (firstResult.rateLimited) {
      return { ventas: firstResult.ventas, rateLimited: true, endpoint: endpointUsed }
    }

    // Primary worked — continue with remaining locals
    const allVentas = [...firstResult.ventas]
    for (let i = 1; i < localIds.length; i++) {
      const result = await fetchAllPagesForLocal(token, primaryPath, localIds[i], f1, f2, true)
      allVentas.push(...result.ventas)
      if (result.rateLimited) {
        return { ventas: allVentas, rateLimited: true, endpoint: endpointUsed }
      }
    }
    return { ventas: allVentas, rateLimited: false, endpoint: endpointUsed }
  } catch {
    // Primary endpoint failed on first request — switch to fallback
    console.warn('Primary endpoint failed, falling back to obtenerVentasPorIntegracion')
    endpointPath = fallbackPath
    endpointUsed = 'obtenerVentasPorIntegracion'
  }

  // Fallback path: process all locals with the integration endpoint
  const allVentas: unknown[] = []
  for (let i = 0; i < localIds.length; i++) {
    const result = await fetchAllPagesForLocal(token, endpointPath, localIds[i], f1, f2, i > 0)
    allVentas.push(...result.ventas)
    if (result.rateLimited) {
      return { ventas: allVentas, rateLimited: true, endpoint: endpointUsed }
    }
  }
  return { ventas: allVentas, rateLimited: false, endpoint: endpointUsed }
}

export const posProxy = onRequest(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [posToken],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    try {
      const { action, params } = req.body as PosProxyRequest
      const token = posToken.value()

      if (!action) {
        res.status(400).json({ error: 'action is required' })
        return
      }

      let data: unknown

      switch (action) {
        case 'dominio': {
          const url = buildUrl(`/readonly/rest/delivery/obtenerInformacionDominio/${POS_DOMAIN_ID}`, token)
          data = await fetchPosApi(url)
          break
        }

        case 'ventas': {
          if (!params?.local_id || !params?.f1 || !params?.f2) {
            res.status(400).json({ error: 'ventas requires local_id, f1, f2' })
            return
          }
          const url = buildUrl(`/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`, token)
          data = await fetchPosApi(url, 'POST', {
            pagina: params.pagina ?? 1,
            local_id: params.local_id,
            f1: params.f1,
            f2: params.f2,
          })
          break
        }

        case 'ventas-batch': {
          if (!params?.local_ids?.length || !params?.f1 || !params?.f2) {
            res.status(400).json({ error: 'ventas-batch requires local_ids (array), f1, f2' })
            return
          }
          const batchResult = await fetchVentasBatch(token, params.local_ids, params.f1, params.f2)
          res.json({ success: true, data: batchResult })
          return
        }

        case 'catalogo': {
          if (!params?.local_id) {
            res.status(400).json({ error: 'catalogo requires local_id' })
            return
          }
          const url = buildUrl(`/readonly/rest/delivery/obtenerCartaPorLocal/${POS_DOMAIN_ID}/${params.local_id}`, token)
          data = await fetchPosApi(url)
          break
        }

        default:
          res.status(400).json({ error: `Unknown action: ${action}` })
          return
      }

      res.json({ success: true, data })
    } catch (error: unknown) {
      console.error('POS Proxy error:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  }
)
