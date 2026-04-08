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
    throw new Error(json.data.mensajes?.join(', ') || `POS error tipo ${tipo}`)
  }

  return { data: json.data.data, mensajes: json.data.mensajes }
}

export const posService = {
  getDominio: async () => {
    const { data } = await callProxy<PosDominioData>('dominio')
    return data
  },

  getVentas: async (localId: number, f1: string, f2: string, pagina = 1) => {
    const { data } = await callProxy<Record<string, PosVenta> | PosVenta[]>('ventas', {
      local_id: localId, f1, f2, pagina,
    })
    // API returns an object with numeric keys, convert to array
    return Array.isArray(data) ? data : Object.values(data)
  },

  getCatalogo: async (localId: number) => {
    const { data } = await callProxy<PosProducto[]>('catalogo', { local_id: localId })
    return Array.isArray(data) ? data : Object.values(data)
  },
}
