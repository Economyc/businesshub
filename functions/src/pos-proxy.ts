import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

const posToken = defineSecret('POS_TOKEN')

const POS_BASE_URL = 'http://api.restaurant.pe/restaurant'
const POS_DOMAIN_ID = '8267'

type PosAction = 'ventas' | 'catalogo' | 'dominio'

interface PosProxyRequest {
  action: PosAction
  params?: {
    local_id?: number
    f1?: string
    f2?: string
    pagina?: number
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Authorization': `Token token='${token}'`,
    'Content-Type': 'application/json',
  }
}

async function fetchPosApi(url: string, token: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
  const opts: RequestInit = {
    method,
    headers: buildHeaders(token),
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

export const posProxy = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
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
          const url = `${POS_BASE_URL}/readonly/rest/delivery/obtenerInformacionDominio/${POS_DOMAIN_ID}`
          data = await fetchPosApi(url, token)
          break
        }

        case 'ventas': {
          if (!params?.local_id || !params?.f1 || !params?.f2) {
            res.status(400).json({ error: 'ventas requires local_id, f1, f2' })
            return
          }
          const url = `${POS_BASE_URL}/readonly/rest/venta/obtenerVentasPorIntegracion/${POS_DOMAIN_ID}`
          data = await fetchPosApi(url, token, 'POST', {
            pagina: params.pagina ?? 1,
            local_id: params.local_id,
            f1: params.f1,
            f2: params.f2,
          })
          break
        }

        case 'catalogo': {
          if (!params?.local_id) {
            res.status(400).json({ error: 'catalogo requires local_id' })
            return
          }
          const url = `${POS_BASE_URL}/readonly/rest/delivery/obtenerCartaPorLocal/${POS_DOMAIN_ID}/${params.local_id}`
          data = await fetchPosApi(url, token)
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
