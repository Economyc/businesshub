import type { PosDominioData, PosVenta, PosProducto } from './types'

const PROXY_URL = import.meta.env.VITE_POS_PROXY_URL as string

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

async function callProxy<T>(action: string, params?: Record<string, unknown>): Promise<{ data: T; mensajes: string[] }> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
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
  getDominio: async () => {
    const { data } = await callProxy<PosDominioData>('dominio')
    return data
  },

  getVentas: async (localId: number, f1: string, f2: string) => {
    let pagina = 1
    const allVentas: PosVenta[] = []
    while (true) {
      if (pagina > 1) await wait(API_DELAY)
      const { data } = await callProxy<Record<string, PosVenta> | PosVenta[]>('ventas', {
        local_id: localId, f1, f2, pagina,
      })
      const page = Array.isArray(data) ? data : Object.values(data)
      if (page.length === 0) break
      allVentas.push(...page)
      pagina++
    }
    return allVentas
  },

  getVentasBatch: async (localIds: number[], f1: string, f2: string) => {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ventas-batch', params: { local_ids: localIds, f1, f2 } }),
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

  getCatalogo: async (localId: number) => {
    const { data } = await callProxy<PosProducto[]>('catalogo', { local_id: localId })
    return Array.isArray(data) ? data : Object.values(data)
  },
}
