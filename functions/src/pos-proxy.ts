import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import {
  POS_DOMAIN_ID,
  buildUrl,
  fetchPosApi,
  extractVentas,
  fetchAllPagesForLocal,
  type PosApiResponse,
} from './pos-client.js'

const posToken = defineSecret('POS_TOKEN')

type PosAction = 'ventas' | 'ventas-batch' | 'catalogo' | 'dominio' | 'probe'

interface PosProxyRequest {
  action: PosAction
  params?: {
    local_id?: number
    local_ids?: number[]
    f1?: string
    f2?: string
    pagina?: number
    endpoint_path?: string
    [key: string]: unknown
  }
}

async function fetchVentasBatch(
  token: string,
  localIds: number[],
  f1: string,
  f2: string,
): Promise<{ ventas: unknown[]; rateLimited: boolean; endpoint: string }> {
  const allVentas: unknown[] = []
  for (const lid of localIds) {
    const result = await fetchAllPagesForLocal(token, lid, f1, f2)
    allVentas.push(...result.ventas)
    if (result.rateLimited) {
      return { ventas: allVentas, rateLimited: true, endpoint: 'obtenerVentasPorIntegracion' }
    }
  }
  return { ventas: allVentas, rateLimited: false, endpoint: 'obtenerVentasPorIntegracion' }
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
            incluirNotasVenta: 1,
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

        case 'probe': {
          if (!params?.endpoint_path || !params?.local_id || !params?.f1 || !params?.f2) {
            res.status(400).json({ error: 'probe requires endpoint_path, local_id, f1, f2' })
            return
          }
          try {
            const url = buildUrl(params.endpoint_path, token)
            const body = { local_id: params.local_id, f1: params.f1, f2: params.f2, pagina: params.pagina ?? 1, ...params }
            delete (body as Record<string, unknown>).endpoint_path
            delete (body as Record<string, unknown>).local_ids
            const rawResponse = await fetchPosApi(url, 'POST', body)
            const posResp = rawResponse as PosApiResponse
            const ventas = extractVentas(posResp)
            const tipos = ventas
              .map((v) => (v as Record<string, unknown>).tipo_documento)
              .filter(Boolean)
            const uniqueTipos = [...new Set(tipos)]
            const docs = ventas.slice(0, 5).map((v) => {
              const rec = v as Record<string, unknown>
              return {
                documento: rec.documento,
                tipo_documento: rec.tipo_documento,
                total: rec.total,
                fecha: rec.fecha,
              }
            })
            res.json({
              success: true,
              endpoint: params.endpoint_path,
              tipo: posResp.tipo,
              mensajes: posResp.mensajes,
              ventasCount: ventas.length,
              uniqueTipos,
              sampleDocs: docs,
            })
          } catch (err: unknown) {
            res.json({
              success: false,
              endpoint: params.endpoint_path,
              error: err instanceof Error ? err.message : String(err),
            })
          }
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
  },
)
