import type { PosDominioData, PosVenta, PosProducto } from './types'

const PROXY_URL = import.meta.env.VITE_POS_PROXY_URL as string

interface ProxyResponse<T> {
  success: boolean
  data: {
    tipo: number
    data: T
    mensajes: string[]
  }
  error?: string
}

async function callProxy<T>(action: string, params?: Record<string, unknown>): Promise<T> {
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

  return json.data.data
}

export const posService = {
  getDominio: () => callProxy<PosDominioData>('dominio'),

  getVentas: (localId: number, f1: string, f2: string, pagina = 1) =>
    callProxy<PosVenta[]>('ventas', { local_id: localId, f1, f2, pagina }),

  getCatalogo: (localId: number) =>
    callProxy<PosProducto[]>('catalogo', { local_id: localId }),
}
