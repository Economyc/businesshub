import { useCallback, useEffect, useState } from 'react'

// Wave 6.2 — Configuración del connector a Obsidian.
//
// El plugin "Local REST API" expone el vault local en https://127.0.0.1:27124
// (HTTPS con cert autofirmado) o http://127.0.0.1:27123 (HTTP plano). El
// usuario configura endpoint + API token desde un dialog en el chat. Lo
// guardamos en localStorage del navegador porque:
//   1. Es un secreto local del usuario, no debe replicarse en Firestore.
//   2. El endpoint sólo es alcanzable desde la máquina del usuario.
//   3. No tiene sentido sincronizarlo entre dispositivos.

const ENDPOINT_KEY = 'bukz.obsidian.endpoint'
const TOKEN_KEY = 'bukz.obsidian.token'

export interface ObsidianConfig {
  endpoint: string
  token: string
  isConfigured: boolean
  save: (endpoint: string, token: string) => void
  clear: () => void
  reload: () => void
}

function readStorage(): { endpoint: string; token: string } {
  if (typeof window === 'undefined') return { endpoint: '', token: '' }
  try {
    return {
      endpoint: window.localStorage.getItem(ENDPOINT_KEY) ?? '',
      token: window.localStorage.getItem(TOKEN_KEY) ?? '',
    }
  } catch {
    return { endpoint: '', token: '' }
  }
}

export function useObsidianConfig(): ObsidianConfig {
  const [{ endpoint, token }, setState] = useState(readStorage)

  // Reaccionar a cambios desde otras pestañas / otros componentes.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onStorage(e: StorageEvent) {
      if (e.key === ENDPOINT_KEY || e.key === TOKEN_KEY) {
        setState(readStorage())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const save = useCallback((nextEndpoint: string, nextToken: string) => {
    const cleanEndpoint = nextEndpoint.trim().replace(/\/+$/, '')
    const cleanToken = nextToken.trim()
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ENDPOINT_KEY, cleanEndpoint)
        window.localStorage.setItem(TOKEN_KEY, cleanToken)
      }
    } catch (err) {
      console.error('[obsidian] no se pudo guardar config en localStorage:', err)
    }
    setState({ endpoint: cleanEndpoint, token: cleanToken })
  }, [])

  const clear = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(ENDPOINT_KEY)
        window.localStorage.removeItem(TOKEN_KEY)
      }
    } catch {
      // ignore
    }
    setState({ endpoint: '', token: '' })
  }, [])

  const reload = useCallback(() => {
    setState(readStorage())
  }, [])

  return {
    endpoint,
    token,
    isConfigured: endpoint.length > 0 && token.length > 0,
    save,
    clear,
    reload,
  }
}
