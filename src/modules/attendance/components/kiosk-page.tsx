import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Camera, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompanyLogo } from '@/core/ui/company-logo'
import { cn } from '@/lib/utils'
import { useCamera, captureFrame, canvasToJpegBase64, CAMERA_ERROR } from '../camera'
import { describeFace, loadFaceApi, DESCRIBE_ERROR } from '../face'
import { attendanceService, formatTimeBogota } from '../services'
import { PUNCH_TYPE_LABEL, type KioskInfo, type PunchType } from '../types'
import logoBlue from '../assets/logo-blue-smash.png'
import logoFilipo from '../assets/logo-filipo.png'

// Pantalla publica de marcacion (`/marcar/:token`). Se deja abierta en la tablet
// o PC fijo del local: no tiene sesion ni menu, solo la camara y "Tomar foto".

/** Cuanto se muestra el resultado antes de volver a la camara. */
const RESULT_MS = 4000
/** Intentos fallidos seguidos antes de sugerir avisar al administrador. */
const FAILS_BEFORE_HELP = 3

// Logo en texto de cada marca, por la primera palabra del nombre de la company
// ("Blue Smash Brgr", "Filipo"). `logoClass` iguala el peso visual: el de Blue es
// un bloque de tres lineas y el de Filipo una sola palabra ancha.
const BRAND_LOGOS: Record<string, { src: string; className: string }> = {
  blue: { src: logoBlue, className: 'h-16' },
  filipo: { src: logoFilipo, className: 'h-10' },
}

function brandLogo(companyName: string) {
  const first = companyName.trim().split(/\s+/)[0] ?? ''
  return BRAND_LOGOS[first.toLowerCase()] ?? null
}

type Result =
  | { kind: 'ok'; name: string; type: PunchType; at: Date; duplicate: boolean }
  | { kind: 'error'; message: string }

export function KioskPage() {
  const { token = '' } = useParams()
  const info = useQuery({
    queryKey: ['attendanceKioskInfo', token],
    queryFn: () => attendanceService.kioskInfo(token),
    retry: 1,
    staleTime: Infinity,
  })
  const models = useQuery({ queryKey: ['faceApiModels'], queryFn: async () => { await loadFaceApi(); return true }, staleTime: Infinity, retry: 2 })

  if (info.isError) {
    return (
      <Screen>
        <XCircle size={24} strokeWidth={1.5} className="text-negative-text" />
        <p className="text-subheading font-medium text-dark-graphite">Este link de marcación no es válido</p>
        <p className="text-body text-mid-gray max-w-sm text-center">Pide al administrador el link actual del local.</p>
      </Screen>
    )
  }
  if (!info.data) {
    return <Screen><Loader2 size={24} strokeWidth={1.5} className="animate-spin text-mid-gray" /></Screen>
  }

  return <Kiosk token={token} info={info.data} modelsReady={models.isSuccess} modelsError={models.isError} />
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface p-6">{children}</div>
}

function Kiosk({
  token,
  info,
  modelsReady,
  modelsError,
}: {
  token: string
  info: KioskInfo
  modelsReady: boolean
  modelsError: boolean
}) {
  const { videoRef, status } = useCamera()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const fails = useRef(0)
  const now = useClock()
  useWakeLock()

  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => setResult(null), RESULT_MS)
    return () => clearTimeout(t)
  }, [result])

  function fail(message: string) {
    fails.current += 1
    const help = fails.current >= FAILS_BEFORE_HELP ? ' Si sigue sin funcionar, avisa al administrador.' : ''
    setResult({ kind: 'error', message: message + help })
  }

  async function takePhoto() {
    const video = videoRef.current
    if (!video || busy) return
    setBusy(true)
    try {
      const frame = captureFrame(video)
      const face = await describeFace(frame, { single: false })
      if (!face.ok) {
        fail(DESCRIBE_ERROR[face.reason])
        return
      }
      const res = await attendanceService.punch(token, face.descriptor, canvasToJpegBase64(frame, 480, 0.7))
      if (!res.matched) {
        fail('No te reconocí. Mira de frente a la cámara e intenta de nuevo.')
        return
      }
      fails.current = 0
      setResult({ kind: 'ok', name: res.employeeName, type: res.type, at: new Date(res.at), duplicate: res.duplicate })
    } catch {
      fail('No hay conexión. Intenta de nuevo en un momento.')
    } finally {
      setBusy(false)
    }
  }

  const ready = status === 'ready' && modelsReady
  const logo = brandLogo(info.companyName)

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="grid grid-cols-1 items-center gap-4 border-b border-border/60 bg-card-bg px-6 py-4 sm:grid-cols-3">
        <div className="min-w-0 text-center sm:text-left">
          <p className="truncate text-heading font-medium text-dark-graphite">{info.companyName}</p>
          {info.location && <p className="truncate text-body text-mid-gray">Sede {info.location}</p>}
        </div>
        <div className="flex justify-center">
          {logo ? (
            <img src={logo.src} alt={info.companyName} className={cn('w-auto dark:invert', logo.className)} />
          ) : (
            <CompanyLogo company={{ name: info.companyName, color: info.color ?? undefined, logo: info.logo ?? undefined, logoThumb: info.logoThumb ?? undefined }} size="xl" />
          )}
        </div>
        <div className="text-center sm:text-right">
          <p className="text-kpi font-semibold tabular-nums text-dark-graphite">{formatTimeBogota(now)}</p>
          <p className="text-body capitalize text-mid-gray">
            {new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="relative aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-smoke">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover -scale-x-100" />
          {/* Guia: ovalo donde va la cara. */}
          {status === 'ready' && !result && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[70%] aspect-[3/4] rounded-full border-2 border-dashed border-card-bg/80" />
            </div>
          )}
          {status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-body text-mid-gray">
              {status === 'starting' ? <Loader2 size={24} strokeWidth={1.5} className="animate-spin" /> : CAMERA_ERROR[status]}
            </div>
          )}
          {result && <ResultOverlay result={result} />}
        </div>

        {modelsError ? (
          <p className="text-body text-negative-text">No se pudo cargar el reconocimiento facial. Revisa la conexión y recarga la página.</p>
        ) : (
          // El tamano va en el <span>: en el className del Button, tailwind-merge
          // toma `text-subheading` por un color y borra el text-primary-foreground.
          <Button size="lg" className="h-16 w-full max-w-sm rounded-2xl" onClick={takePhoto} disabled={!ready || busy || result !== null}>
            {busy || !modelsReady ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin" /> : <Camera size={20} strokeWidth={1.5} />}
            <span className="text-subheading">{!modelsReady ? 'Preparando…' : busy ? 'Reconociendo…' : 'Tomar foto'}</span>
          </Button>
        )}
      </main>
    </div>
  )
}

function ResultOverlay({ result }: { result: Result }) {
  const ok = result.kind === 'ok'
  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center', ok ? 'bg-positive-bg' : 'bg-negative-bg')}>
      {ok ? (
        <>
          <CheckCircle2 size={24} strokeWidth={1.5} className="text-positive-text" />
          <p className="text-kpi font-semibold text-positive-text">Hola, {result.name.split(' ')[0]}</p>
          <p className="text-subheading text-positive-text">
            {result.duplicate
              ? `Tu ${PUNCH_TYPE_LABEL[result.type].toLowerCase()} ya quedó registrada a las ${formatTimeBogota(result.at)}`
              : `${PUNCH_TYPE_LABEL[result.type]} registrada · ${formatTimeBogota(result.at)}`}
          </p>
        </>
      ) : (
        <>
          <XCircle size={24} strokeWidth={1.5} className="text-negative-text" />
          <p className="max-w-md text-subheading text-negative-text">{result.message}</p>
        </>
      )}
    </div>
  )
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Evita que la tablet apague la pantalla mientras el link esta abierto. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () => {
      navigator.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => undefined)
    }
    request()
    const onVisible = () => { if (document.visibilityState === 'visible') request() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => undefined)
    }
  }, [])
}
