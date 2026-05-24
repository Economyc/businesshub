import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Cloud, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/core/hooks/use-permissions'
import { useDriveAuth } from '@/core/hooks/use-drive-auth'

const DAY_MS = 24 * 60 * 60 * 1000
// El token de Drive expira a los 7 días (OAuth consent screen en modo Testing).
const EXPIRY_MS = 7 * DAY_MS
// Avisamos ~1 día antes para reconectar sin que nada se interrumpa.
const WARN_LEAD_MS = 1 * DAY_MS
// "Más tarde" en el aviso proactivo silencia el popup 24h. El aviso de "ya
// expiró" solo se silencia por la sesión actual (reaparece al recargar).
const SNOOZE_EXPIRING_MS = 1 * DAY_MS
const SNOOZE_KEY = 'bh:drive-reconnect-snoozed'
const SNOOZE_SESSION_KEY = 'bh:drive-reconnect-snoozed-session'

type Severity = 'ok' | 'expiring' | 'expired'

/**
 * Popup global que avisa al owner cuando su conexión de Google Drive está por
 * expirar o ya expiró, y permite reconectar en un clic. Solo aplica al owner:
 * es quien provee el Drive de la empresa (`resolveDriveUid` → owner). Se monta
 * en el Layout, dentro de PermissionsProvider + QueryClientProvider.
 */
export function DriveReconnectModal() {
  const { isOwner } = usePermissions()
  const { status, isLoading, connect, connecting } = useDriveAuth({ enabled: isOwner })
  const [snoozeVersion, setSnoozeVersion] = useState(0)

  const severity: Severity = useMemo(() => {
    if (!status) return 'ok'
    if (!status.connected) return 'expired'
    const ageMs = status.connectedAt ? Date.now() - status.connectedAt : Infinity
    if (ageMs >= EXPIRY_MS - WARN_LEAD_MS) return 'expiring'
    return 'ok'
  }, [status])

  // Al reconectar (vuelve a 'ok') limpiamos el silencio para futuros avisos.
  useEffect(() => {
    if (severity === 'ok') {
      localStorage.removeItem(SNOOZE_KEY)
      sessionStorage.removeItem(SNOOZE_SESSION_KEY)
    }
  }, [severity])

  const snoozed = useMemo(() => {
    void snoozeVersion // recalcular tras "Más tarde"
    if (severity === 'expiring') {
      const ts = Number(localStorage.getItem(SNOOZE_KEY))
      return Number.isFinite(ts) && ts > 0 && Date.now() - ts < SNOOZE_EXPIRING_MS
    }
    if (severity === 'expired') {
      return sessionStorage.getItem(SNOOZE_SESSION_KEY) === '1'
    }
    return false
  }, [severity, snoozeVersion])

  const open = Boolean(isOwner && !isLoading && severity !== 'ok' && !snoozed)

  function snooze() {
    if (severity === 'expiring') localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    else if (severity === 'expired') sessionStorage.setItem(SNOOZE_SESSION_KEY, '1')
    setSnoozeVersion((v) => v + 1)
  }

  const isExpired = severity === 'expired'
  const daysLeft =
    status?.connectedAt != null
      ? Math.max(0, Math.ceil((EXPIRY_MS - (Date.now() - status.connectedAt)) / DAY_MS))
      : null

  const title = isExpired ? 'Reconecta Google Drive' : 'Tu Google Drive expira pronto'
  const body = isExpired
    ? 'Tu conexión con Google Drive se desconectó. Las subidas de facturas y la actualización de las hojas contables no funcionarán hasta que reconectes.'
    : 'Tu conexión con Google Drive expira pronto. Reconéctala para que las subidas de facturas y la actualización de las hojas contables no se interrumpan.'

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) snooze()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                isExpired ? 'bg-negative-bg' : 'bg-warning-bg',
              )}
            >
              <AlertTriangle
                size={18}
                strokeWidth={1.5}
                className={isExpired ? 'text-negative-text' : 'text-warning-text'}
              />
            </span>
            <DialogTitle className="text-heading">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-body text-mid-gray">{body}</DialogDescription>
        </DialogHeader>

        {severity === 'expiring' && daysLeft != null && (
          <p className="text-caption text-mid-gray">
            Quedan aproximadamente {daysLeft} día{daysLeft === 1 ? '' : 's'}.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={snooze} disabled={connecting}>
            Más tarde
          </Button>
          <Button onClick={() => void connect()} disabled={connecting}>
            {connecting ? (
              <>
                <Loader2 className="animate-spin" />
                Esperando autorización…
              </>
            ) : (
              <>
                <Cloud />
                {isExpired ? 'Reconectar Drive' : 'Reconectar ahora'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
