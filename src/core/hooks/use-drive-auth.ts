import { useCallback, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAppFunctions } from '@/core/firebase/config'

export interface DriveAuthStatus {
  connected: boolean
  email: string | null
  connectedAt: number | null
}

const DRIVE_AUTH_STATUS_KEY = ['driveAuthStatus'] as const

async function fetchDriveAuthStatus(): Promise<DriveAuthStatus> {
  const fns = await getAppFunctions()
  const fn = httpsCallable<Record<string, never>, DriveAuthStatus>(fns, 'driveAuthStatus')
  const res = await fn({})
  return res.data
}

/**
 * Estado de conexión del Google Drive del usuario actual. Una sola conexión por
 * usuario sirve para todas sus empresas. Compartido vía React Query, así que el
 * popup global y la pantalla de Ajustes leen el mismo cache (sin doble fetch).
 */
export function useDriveAuthStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: DRIVE_AUTH_STATUS_KEY,
    queryFn: fetchDriveAuthStatus,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook unificado del flujo OAuth de Drive: estado + conectar + desconectar.
 * `connect()` reabre el flujo de Google en un popup y, al cerrarse, invalida el
 * estado para reflejar la nueva conexión.
 */
export function useDriveAuth(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient()
  const status = useDriveAuthStatus(options)
  const [connecting, setConnecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: DRIVE_AUTH_STATUS_KEY }),
    [queryClient],
  )

  const connect = useCallback(async () => {
    setConnecting(true)
    setActionError(null)
    try {
      const fns = await getAppFunctions()
      const fn = httpsCallable<Record<string, never>, { url: string }>(fns, 'driveAuthStart')
      const res = await fn({})
      const url = res.data.url
      const w = 500
      const h = 700
      const left = window.screenX + (window.outerWidth - w) / 2
      const top = window.screenY + (window.outerHeight - h) / 2
      const popup = window.open(url, 'drive-oauth', `width=${w},height=${h},left=${left},top=${top}`)
      if (!popup) {
        setActionError('El navegador bloqueó el popup. Permite popups para este sitio.')
        setConnecting(false)
        return
      }
      function onMessage(e: MessageEvent) {
        if (!e.data || e.data.type !== 'drive-oauth') return
        window.removeEventListener('message', onMessage)
        setConnecting(false)
        if (e.data.status === 'ok') {
          void refresh()
        } else {
          setActionError(e.data.message ?? 'Error al conectar')
        }
      }
      window.addEventListener('message', onMessage)
      const poll = setInterval(() => {
        if (popup.closed) {
          clearInterval(poll)
          window.removeEventListener('message', onMessage)
          setConnecting(false)
          void refresh()
        }
      }, 1000)
    } catch (err) {
      setActionError((err as Error).message ?? 'Error de red')
      setConnecting(false)
    }
  }, [refresh])

  const disconnect = useCallback(async () => {
    setActionError(null)
    try {
      const fns = await getAppFunctions()
      const fn = httpsCallable<Record<string, never>, { ok: boolean }>(fns, 'driveAuthDisconnect')
      await fn({})
      await refresh()
    } catch (err) {
      setActionError((err as Error).message ?? 'Error de red')
    }
  }, [refresh])

  return {
    status: status.data,
    isLoading: status.isLoading,
    isError: status.isError,
    queryError: status.error,
    connecting,
    actionError,
    connect,
    disconnect,
    refresh,
  }
}
