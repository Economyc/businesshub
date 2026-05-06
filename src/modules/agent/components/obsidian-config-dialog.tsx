import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useObsidianConfig } from '../hooks/use-obsidian-config'
import { testObsidianConnection } from '../utils/obsidian-client'

interface ObsidianConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

export function ObsidianConfigDialog({ open, onOpenChange, onSaved }: ObsidianConfigDialogProps) {
  const config = useObsidianConfig()
  const [endpoint, setEndpoint] = useState(config.endpoint)
  const [token, setToken] = useState(config.token)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  useEffect(() => {
    if (open) {
      setEndpoint(config.endpoint)
      setToken(config.token)
      setTest({ status: 'idle' })
    }
  }, [open, config.endpoint, config.token])

  const isHttps = endpoint.trim().toLowerCase().startsWith('https://')

  async function handleTest() {
    setTest({ status: 'testing' })
    const result = await testObsidianConnection({
      endpoint: endpoint.trim(),
      token: token.trim(),
    })
    if (result.ok) {
      setTest({ status: 'ok' })
    } else {
      setTest({ status: 'error', message: result.error ?? 'Error desconocido' })
    }
  }

  function handleSave() {
    config.save(endpoint, token)
    onSaved?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-subheading text-dark-graphite font-medium">
            Conectar con Obsidian
          </DialogTitle>
          <DialogDescription className="text-caption text-mid-gray">
            Configura el endpoint local del plugin "Local REST API" de tu vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-caption font-medium text-graphite">Endpoint</label>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://127.0.0.1:27124"
              className="text-body"
            />
            <p className="text-caption text-mid-gray">
              Por defecto el plugin escucha en https://127.0.0.1:27124 (TLS) o http://127.0.0.1:27123.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-caption font-medium text-graphite">API token</label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega aquí tu API key del plugin"
              className="text-body"
            />
            <p className="text-caption text-mid-gray">
              Se guarda sólo en este navegador (localStorage). No se sincroniza con la nube.
            </p>
          </div>

          {isHttps && (
            <div className="rounded-lg border border-border/60 bg-warning-bg p-4">
              <p className="text-caption text-warning-text">
                El plugin usa un certificado autofirmado. Tu navegador puede bloquear la conexión la primera vez.
              </p>
              <a
                href={endpoint.trim()}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-warning-text hover:underline"
              >
                Abrir endpoint y aceptar el certificado
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-card-bg p-4">
            <p className="text-caption text-mid-gray">
              Si el navegador bloquea la solicitud por CORS, agrega el origen actual a la lista de permitidos del plugin: <span className="text-graphite">{typeof window !== 'undefined' ? window.location.origin : 'tu dominio'}</span>.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!endpoint.trim() || !token.trim() || test.status === 'testing'}
            >
              {test.status === 'testing' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Probando…
                </>
              ) : (
                'Probar conexión'
              )}
            </Button>

            {test.status === 'ok' && (
              <span className="flex items-center gap-1 text-caption text-positive-text">
                <CheckCircle2 size={14} strokeWidth={1.5} />
                Conexión OK
              </span>
            )}
            {test.status === 'error' && (
              <span className="flex items-center gap-1 text-caption text-negative-text truncate max-w-[60%]">
                <XCircle size={14} strokeWidth={1.5} />
                <span className="truncate">{test.message}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!endpoint.trim() || !token.trim()}
            >
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
