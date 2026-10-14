import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'ready' | 'denied' | 'unavailable'

/** Sin cuadros nuevos durante esto, la camara se da por congelada. */
const FROZEN_MS = 10_000
/** Track en `mute` (otra app tomo la camara, la tablet la suspendio) mas de esto. */
const MUTED_MS = 3_000

/**
 * Enciende la camara frontal y la conecta a un <video>. Se apaga al desmontar.
 *
 * En una tablet que pasa dias abierta la camara a veces se corta (`ended`), se
 * silencia (`mute`) o deja de entregar cuadros sin avisar: la foto sale igual a
 * la ultima y nadie es reconocido. Con `watchdog` se vigila y se reinicia sola;
 * `restart()` permite forzarlo.
 */
export function useCamera(enabled = true, { watchdog = false }: { watchdog?: boolean } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [generation, setGeneration] = useState(0)
  const restart = useCallback(() => setGeneration((g) => g + 1), [])

  useEffect(() => {
    if (!enabled) return
    let stream: MediaStream | null = null
    let cancelled = false
    let stopWatch: (() => void) | null = null
    const videoEl = videoRef.current
    setStatus('starting')

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          // Safari en iPhone solo reproduce inline y en silencio si los atributos
          // estan en el DOM (React no escribe `muted` como atributo).
          video.muted = true
          video.setAttribute('muted', '')
          video.setAttribute('playsinline', '')
          video.srcObject = s
          await video.play().catch(() => undefined)
          await waitForFrames(video)
        }
        if (cancelled) return
        setStatus('ready')
        if (watchdog && video) stopWatch = watchCamera(video, s, restart)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })

    return () => {
      cancelled = true
      stopWatch?.()
      stream?.getTracks().forEach((t) => t.stop())
      // Soltar la referencia: algunos navegadores retienen la camara si no.
      if (videoEl) videoEl.srcObject = null
    }
  }, [enabled, generation, watchdog, restart])

  return { videoRef, status, restart }
}

/** Reinicia la camara si el track termina, queda en mute o el video deja de
 *  recibir cuadros. Devuelve la funcion para dejar de vigilar. */
function watchCamera(video: HTMLVideoElement, stream: MediaStream, restart: () => void): () => void {
  const track = stream.getVideoTracks()[0]
  let muteTimer: ReturnType<typeof setTimeout> | null = null
  const onEnded = () => restart()
  const onMute = () => { muteTimer = setTimeout(restart, MUTED_MS) }
  const onUnmute = () => { if (muteTimer) clearTimeout(muteTimer) }
  track?.addEventListener('ended', onEnded)
  track?.addEventListener('mute', onMute)
  track?.addEventListener('unmute', onUnmute)

  // Cuadros nuevos: requestVideoFrameCallback donde existe (Chrome, Safari
  // 15.4+); si no, que `currentTime` avance.
  let lastFrameAt = Date.now()
  let lastTime = video.currentTime
  let frameHandle: number | null = null
  type RVFC = (cb: () => void) => number
  const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: RVFC }).requestVideoFrameCallback?.bind(video)
  const onFrame = () => {
    lastFrameAt = Date.now()
    frameHandle = rvfc!(onFrame)
  }
  if (rvfc) frameHandle = rvfc(onFrame)

  const check = setInterval(() => {
    if (document.visibilityState !== 'visible') {
      lastFrameAt = Date.now()
      return
    }
    if (video.paused) video.play().catch(() => undefined)
    if (!rvfc && video.currentTime !== lastTime) {
      lastTime = video.currentTime
      lastFrameAt = Date.now()
    }
    if (Date.now() - lastFrameAt > FROZEN_MS) restart()
  }, 2_000)

  return () => {
    clearInterval(check)
    if (muteTimer) clearTimeout(muteTimer)
    if (frameHandle !== null) {
      const cancel = (video as HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }).cancelVideoFrameCallback
      cancel?.call(video, frameHandle)
    }
    track?.removeEventListener('ended', onEnded)
    track?.removeEventListener('mute', onMute)
    track?.removeEventListener('unmute', onUnmute)
  }
}

/** Espera a que el video tenga cuadros reales: hasta entonces `videoWidth` es 0
 *  y una foto saldria vacia. Tope de 5 s para no dejar la pantalla colgada. */
function waitForFrames(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('loadeddata', done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, 5000)
    video.addEventListener('loadeddata', done)
  })
}

/** true mientras la pestana se ve. Oculta (otra pestana, ventana minimizada,
 *  pantalla bloqueada) conviene soltar la camara: consume bateria y CPU. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}

export const CAMERA_ERROR: Record<'denied' | 'unavailable', string> = {
  denied: 'El navegador no tiene permiso para usar la cámara. Actívalo en la configuración del sitio y recarga la página.',
  unavailable: 'No se encontró una cámara en este equipo.',
}

/** Copia de un canvas reducida a `maxSide` px (el mismo si ya cabe). */
export function fitCanvas(canvas: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  if (scale === 1) return canvas
  const out = document.createElement('canvas')
  out.width = Math.round(canvas.width * scale)
  out.height = Math.round(canvas.height * scale)
  out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height)
  return out
}

/** Brillo medio (0-255) de un rectangulo del canvas, muestreado en una grilla
 *  de 12x12 puntos. */
export function meanLuma(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): number {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const w = Math.max(1, Math.min(canvas.width - x0, Math.floor(width)))
  const h = Math.max(1, Math.min(canvas.height - y0, Math.floor(height)))
  const { data } = canvas.getContext('2d')!.getImageData(x0, y0, w, h)
  let sum = 0
  let n = 0
  for (let gy = 0; gy < 12; gy++) {
    for (let gx = 0; gx < 12; gx++) {
      const px = Math.floor(((gx + 0.5) * w) / 12)
      const py = Math.floor(((gy + 0.5) * h) / 12)
      const i = (py * w + px) * 4
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      n++
    }
  }
  return sum / n
}

/** Copia el cuadro actual del video a un canvas (a lo sumo `maxSide` px). */
export function captureFrame(video: HTMLVideoElement, maxSide = 640): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** true si el cuadro es un solo color (negro o gris): pasa en iPhone cuando el
 *  video aun no entrega imagen. Muestrea una grilla de 8x8 puntos. */
export function isBlankFrame(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  let min = 255
  let max = 0
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x = Math.floor(((gx + 0.5) * canvas.width) / 8)
      const y = Math.floor(((gy + 0.5) * canvas.height) / 8)
      const i = (y * canvas.width + x) * 4
      const luma = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (luma < min) min = luma
      if (luma > max) max = luma
    }
  }
  return max - min < 8
}

/** JPEG en base64 (sin el prefijo data:) de un canvas, reducido a `maxSide`. */
export function canvasToJpegBase64(canvas: HTMLCanvasElement, maxSide: number, quality: number): string {
  return canvasToDataUrl(canvas, maxSide, quality).split(',')[1]
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
  if (scale === 1) return canvas.toDataURL('image/jpeg', quality)
  const out = document.createElement('canvas')
  out.width = Math.round(canvas.width * scale)
  out.height = Math.round(canvas.height * scale)
  out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height)
  return out.toDataURL('image/jpeg', quality)
}

/** Carga una imagen de archivo en un canvas (a lo sumo `maxSide` px). El
 *  navegador ya aplica la orientacion EXIF de las fotos de celular. */
export async function fileToCanvas(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
