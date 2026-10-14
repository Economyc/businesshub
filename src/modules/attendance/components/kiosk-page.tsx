import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Camera, CheckCircle2, Loader2, MapPin, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompanyLogo } from '@/core/ui/company-logo'
import { cn } from '@/lib/utils'
import { useCamera, usePageVisible, captureFrame, canvasToJpegBase64, CAMERA_ERROR } from '../camera'
import {
  describeFace,
  faceBackend,
  loadFaceApi,
  quickFaceHint,
  tensorCount,
  DARK_LUMA,
  DESCRIBE_ERROR,
  type DescribeFailure,
  type DetectionStats,
  type FaceHint,
} from '../face'
import { attendanceService, formatTimeBogota } from '../services'
import { PUNCH_TYPE_LABEL, type KioskClientStats, type KioskInfo, type PunchType } from '../types'
import logoBlue from '../assets/logo-blue-smash.png'
import logoFilipo from '../assets/logo-filipo.png'

// Pantalla publica de marcacion (`/marcar/:token`). Se deja abierta en la tablet
// o PC fijo del local: no tiene sesion ni menu, solo la camara y "Tomar foto".

/** Cuanto se muestra el resultado antes de volver a la camara. */
const RESULT_MS = 4000
/** Con el boton de corregir entrada/salida visible, un poco mas para alcanzar a tocarlo. */
const RESULT_FLIP_MS = 8000
/** Cada cuanto se despierta la funcion de marcar mientras el link se ve. Cloud
 *  Run apaga las instancias ociosas a los ~15 min. */
const WARM_MS = 5 * 60 * 1000
/** Intentos fallidos seguidos antes de sugerir avisar al administrador. */
const FAILS_BEFORE_HELP = 3
/** Fallas seguidas sin ver cara antes de reiniciar la camara en silencio (por
 *  si quedo congelada sin que el vigilante lo notara). */
const FAILS_BEFORE_CAMERA_RESTART = 2

/** Rafaga al tocar "Tomar foto": hasta BURST_FRAMES fotos hasta tener una
 *  buena (una foto movida no hace fallar la marcacion). Si el servidor no
 *  reconoce, se toman RETRY_GOOD mas y se reintenta con todas: varias fotos que
 *  coinciden habilitan el segundo nivel de findMatch. Cada analisis tarda ~1 s,
 *  por eso la rafaga larga solo se paga cuando hace falta. */
const BURST_FRAMES = 3
const RETRY_GOOD = 2
const BURST_GAP_MS = 120
/** Resolucion de la foto: la cara se recorta de aqui (ver describeFace). */
const CAPTURE_SIDE = 1280

/** Recarga diaria de la pagina (libera memoria de tfjs y de la camara): a esta
 *  hora de Colombia, si nadie marco hace un rato. */
const RELOAD_HOUR = 4
const RELOAD_IDLE_MS = 10 * 60 * 1000
/** Tensores de mas sobre lo que habia al arrancar: fuga, recargar. */
const TENSOR_LEAK = 1500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  | { kind: 'ok'; name: string; type: PunchType; at: Date; duplicate: boolean; punchId: string | null }
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
  // La camara solo corre con la pestana a la vista.
  const visible = usePageVisible()
  const { videoRef, status, restart: restartCamera } = useCamera(visible, { watchdog: true })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const fails = useRef(0)
  const blindFails = useRef(0)
  const lastActivity = useRef(Date.now())
  // `?diag=1`: muestra que motor de deteccion uso el equipo y que vio en la foto.
  // Tambien aparece sola tras varios fallos, para que el local mande captura.
  const [params] = useSearchParams()
  const [helpShown, setHelpShown] = useState(false)
  const diag = params.get('diag') === '1' || helpShown
  const [lastStats, setLastStats] = useState<DetectionStats | null>(null)
  const [flipping, setFlipping] = useState(false)
  const now = useClock()
  useWakeLock()
  useWarmPunch(token, visible)
  useDailyReload(modelsReady, lastActivity)
  const ready = status === 'ready' && modelsReady
  const hint = useFaceHint(videoRef, ready && !busy && result === null)

  useEffect(() => {
    if (!result) return
    const ms = result.kind === 'ok' && result.punchId ? RESULT_FLIP_MS : RESULT_MS
    const t = setTimeout(() => setResult(null), ms)
    return () => clearTimeout(t)
  }, [result])

  function fail(message: string) {
    fails.current += 1
    const needsHelp = fails.current >= FAILS_BEFORE_HELP
    if (needsHelp) setHelpShown(true)
    const help = needsHelp ? ' Si sigue sin funcionar, avisa al administrador.' : ''
    setResult({ kind: 'error', message: message + help })
  }

  /** Lo que se manda al servidor para el diagnostico de cada intento. */
  function clientStats(stats: DetectionStats | null, extra: KioskClientStats): KioskClientStats {
    const video = videoRef.current
    const backend = faceBackend()
    return {
      ...(stats?.faces != null ? { faces: stats.faces } : {}),
      ...(stats?.score != null ? { score: stats.score } : {}),
      ...(stats?.facePx != null ? { facePx: stats.facePx } : {}),
      ...(stats?.brightness != null ? { brightness: stats.brightness } : {}),
      ...(video?.videoWidth ? { video: `${video.videoWidth}x${video.videoHeight}` } : {}),
      ...(backend ? { backend: backend.backend } : {}),
      ...(tensorCount() != null ? { tensors: tensorCount()! } : {}),
      uptimeMin: Math.round(performance.now() / 60000),
      ...extra,
    }
  }

  async function takePhoto() {
    const video = videoRef.current
    if (!video || busy) return
    setBusy(true)
    lastActivity.current = Date.now()
    const started = performance.now()
    try {
      const burst = await captureBurst(video, 1)
      setLastStats(burst.stats)
      const ms = Math.round(performance.now() - started)
      if (!burst.ok) {
        void attendanceService.reportAttempt(token, clientStats(burst.stats, { reason: burst.reason, frames: burst.frames, ms }))
        // Sin cara o foto vacia varias veces: puede ser la camara, no la persona.
        if (burst.reason === 'blank-frame' || burst.reason === 'no-face') {
          blindFails.current += 1
          if (blindFails.current >= FAILS_BEFORE_CAMERA_RESTART) {
            blindFails.current = 0
            restartCamera()
          }
        }
        fail(DESCRIBE_ERROR[burst.reason])
        return
      }
      blindFails.current = 0
      const photo = canvasToJpegBase64(burst.frame, 480, 0.7)
      let res = await attendanceService.punch(token, burst.descriptors, photo, clientStats(burst.stats, { frames: burst.frames, ms }))
      if (!res.matched) {
        // Segundo intento con mas fotos antes de decir "no te reconoci".
        const more = await captureBurst(video, RETRY_GOOD)
        if (more.ok) {
          const descriptors = [...burst.descriptors, ...more.descriptors].slice(0, 1 + RETRY_GOOD)
          const total = Math.round(performance.now() - started)
          res = await attendanceService.punch(token, descriptors, photo, clientStats(burst.stats, { frames: burst.frames + more.frames, ms: total }))
        }
      }
      if (!res.matched) {
        const dark = burst.stats.brightness != null && burst.stats.brightness < DARK_LUMA + 20
        fail(dark
          ? 'No te reconocí: hay poca luz en tu cara. Ponte de frente a una luz e intenta de nuevo.'
          : 'No te reconocí. Mira de frente a la cámara, sin gorra ni tapabocas, e intenta de nuevo.')
        return
      }
      fails.current = 0
      setResult({
        kind: 'ok',
        name: res.employeeName,
        type: res.type,
        at: new Date(res.at),
        duplicate: res.duplicate,
        punchId: res.punchId ?? null,
      })
    } catch {
      fail('No hay conexión. Intenta de nuevo en un momento.')
    } finally {
      setBusy(false)
    }
  }

  // El kiosco adivina entrada/salida; si se equivoco, el empleado lo corrige.
  async function flipPunch() {
    if (result?.kind !== 'ok' || !result.punchId || flipping) return
    setFlipping(true)
    try {
      const { type } = await attendanceService.flipPunch(token, result.punchId)
      setResult({ ...result, type, punchId: null })
    } catch {
      setResult({ kind: 'error', message: 'No se pudo corregir. Avisa al administrador.' })
    } finally {
      setFlipping(false)
    }
  }

  const logo = brandLogo(info.companyName)

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="grid grid-cols-1 items-center gap-4 border-b border-border/60 bg-card-bg px-6 py-4 sm:grid-cols-3">
        <div className="min-w-0 text-center sm:text-left">
          <p className="truncate text-heading font-semibold text-dark-graphite">{info.companyName}</p>
          {info.location && (
            <p className="mt-1 flex items-center justify-center gap-1 text-body font-semibold text-graphite sm:justify-start">
              <MapPin size={16} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{info.location}</span>
            </p>
          )}
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
          {/* Guia: ovalo donde va la cara; verde cuando la cara esta bien puesta. */}
          {status === 'ready' && !result && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={cn(
                  'h-[70%] aspect-[3/4] rounded-full border-2',
                  hint === 'ok' ? 'border-solid border-positive-text' : 'border-dashed border-card-bg/80',
                )}
              />
              {hint && hint !== 'none' && (
                <p
                  className={`absolute bottom-4 rounded-full px-4 py-2 text-body font-medium ${
                    hint === 'ok' ? 'bg-positive-bg text-positive-text' : 'bg-card-bg/90 text-dark-graphite'
                  }`}
                >
                  {HINT_TEXT[hint]}
                </p>
              )}
            </div>
          )}
          {status !== 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-body text-mid-gray">
              {status === 'starting' ? <Loader2 size={24} strokeWidth={1.5} className="animate-spin" /> : CAMERA_ERROR[status]}
            </div>
          )}
          {result && <ResultOverlay result={result} flipping={flipping} onFlip={flipPunch} />}
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
        {diag && <DiagLine video={videoRef.current} modelsReady={modelsReady} stats={lastStats} />}
      </main>
    </div>
  )
}

const HINT_TEXT: Record<Exclude<FaceHint, 'none'>, string> = {
  far: 'Acércate un poco',
  'off-center': 'Pon tu cara dentro del óvalo',
  ok: 'Listo, toca Tomar foto',
}

function ResultOverlay({ result, flipping, onFlip }: { result: Result; flipping: boolean; onFlip: () => void }) {
  if (result.kind === 'ok') {
    // Entrada y salida con color distinto: si el kiosco se equivoco, salta a la vista.
    // Clases concatenadas sin cn(): tailwind-merge toma `text-kpi` y el color
    // `text-*-text` por el mismo grupo y borra el tamano.
    const isIn = result.type === 'in'
    const tone = isIn ? 'text-positive-text' : 'text-info-text'
    return (
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center', isIn ? 'bg-positive-bg' : 'bg-info-bg')}>
        <CheckCircle2 size={24} strokeWidth={1.5} className={tone} />
        <p className={`text-heading font-medium ${tone}`}>Hola, {result.name.split(' ')[0]}</p>
        <p className={`text-kpi font-semibold uppercase tracking-wide ${tone}`}>{PUNCH_TYPE_LABEL[result.type]}</p>
        <p className={`text-subheading ${tone}`}>
          {result.duplicate
            ? `Ya había quedado registrada a las ${formatTimeBogota(result.at)}`
            : `Registrada a las ${formatTimeBogota(result.at)}`}
        </p>
        {result.punchId && (
          <Button variant="ghost" size="sm" className="mt-2 rounded-2xl" onClick={onFlip} disabled={flipping}>
            {flipping && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            <span className={`text-body underline underline-offset-4 ${tone}`}>
              {isIn ? '¿Era tu salida? Corregir' : '¿Era tu entrada? Corregir'}
            </span>
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-negative-bg p-6 text-center">
      <XCircle size={24} strokeWidth={1.5} className="text-negative-text" />
      <p className="max-w-md text-subheading text-negative-text">{result.message}</p>
    </div>
  )
}

type Burst =
  | { ok: true; descriptors: number[][]; frame: HTMLCanvasElement; stats: DetectionStats; frames: number }
  | { ok: false; reason: DescribeFailure; stats: DetectionStats; frames: number }

/** Toma hasta BURST_FRAMES fotos seguidas y se queda con hasta `good`
 *  buenas. Solo falla si ninguna sirvio; el motivo es el de la ultima. */
async function captureBurst(video: HTMLVideoElement, good: number): Promise<Burst> {
  const descriptors: number[][] = []
  let firstGood: { frame: HTMLCanvasElement; stats: DetectionStats } | null = null
  let lastFail: { reason: DescribeFailure; stats: DetectionStats } | null = null
  let frames = 0
  while (frames < BURST_FRAMES && descriptors.length < good) {
    if (frames > 0) await sleep(BURST_GAP_MS)
    frames += 1
    const frame = captureFrame(video, CAPTURE_SIDE)
    const face = await describeFace(frame, { single: false })
    if (face.ok) {
      descriptors.push(face.descriptor)
      firstGood ??= { frame, stats: face.stats }
    } else {
      lastFail = { reason: face.reason, stats: face.stats }
      // Lejos o con poca luz, la foto de 100 ms despues sale igual: no insistir.
      if (!firstGood && (face.reason === 'too-far' || face.reason === 'dark')) break
    }
  }
  if (firstGood) return { ok: true, descriptors, frame: firstGood.frame, stats: firstGood.stats, frames }
  return { ok: false, reason: lastFail!.reason, stats: lastFail!.stats, frames }
}

/** Guia en vivo mientras el kiosco espera. Si el equipo es lento la consulta
 *  se espacia, y si es muy lento se apaga (el boton sigue funcionando igual). */
function useFaceHint(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean): FaceHint | null {
  const [hint, setHint] = useState<FaceHint | null>(null)
  const disabled = useRef(false)
  const slowRuns = useRef(0)

  useEffect(() => {
    if (!active || disabled.current) {
      setHint(null)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      const video = videoRef.current
      const started = performance.now()
      let next: FaceHint | null = null
      try {
        next = video ? await quickFaceHint(video) : null
      } catch {
        next = null
      }
      if (cancelled) return
      const took = performance.now() - started
      slowRuns.current = took > 1200 ? slowRuns.current + 1 : 0
      if (slowRuns.current >= 3) {
        disabled.current = true
        setHint(null)
        return
      }
      setHint(next)
      timer = setTimeout(tick, took > 400 ? 2000 : 700)
    }
    timer = setTimeout(tick, 300)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [active, videoRef])

  return hint
}

/** El kiosco pasa dias abierto: se recarga solo de madrugada (o antes si tfjs
 *  esta acumulando memoria), siempre con un rato sin marcaciones. */
function useDailyReload(modelsReady: boolean, lastActivity: { readonly current: number }) {
  useEffect(() => {
    if (!modelsReady) return
    const baseline = tensorCount()
    const bootedAt = Date.now()
    const t = setInterval(() => {
      const idle = Date.now() - lastActivity.current > RELOAD_IDLE_MS
      if (!idle) return
      const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
      const upHours = (Date.now() - bootedAt) / 3_600_000
      const tensors = tensorCount()
      const leaking = baseline != null && tensors != null && tensors - baseline > TENSOR_LEAK
      if ((hour === RELOAD_HOUR && upHours > 2) || upHours > 26 || leaking) window.location.reload()
    }, 60_000)
    return () => clearInterval(t)
  }, [modelsReady, lastActivity])
}

function DiagLine({ video, modelsReady, stats }: { video: HTMLVideoElement | null; modelsReady: boolean; stats: DetectionStats | null }) {
  const backend = faceBackend()
  const parts = [
    modelsReady && backend ? `motor ${backend.backend}` : 'motor cargando',
    backend?.fallbackFrom ? `(antes ${backend.fallbackFrom})` : null,
    backend?.float32 == null ? null : `float32 ${backend.float32 ? 'sí' : 'no'}`,
    video?.videoWidth ? `video ${video.videoWidth}×${video.videoHeight}` : null,
    stats?.blank ? 'foto vacía' : null,
    stats ? `caras ${stats.faces}` : null,
    stats?.score != null ? `score ${stats.score.toFixed(2)}` : null,
    stats?.facePx != null ? `cara ${stats.facePx}px` : null,
    stats?.brightness != null ? `luz ${stats.brightness}` : null,
    tensorCount() != null ? `tensores ${tensorCount()}` : null,
    `encendido ${Math.round(performance.now() / 60000)} min`,
  ].filter(Boolean)
  return <p className="text-caption tabular-nums text-mid-gray">{parts.join(' · ')}</p>
}

function useWarmPunch(token: string, visible: boolean) {
  useEffect(() => {
    if (!visible) return
    const warm = () => { attendanceService.warmPunch(token).catch(() => undefined) }
    warm()
    const t = setInterval(warm, WARM_MS)
    return () => clearInterval(t)
  }, [token, visible])
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
