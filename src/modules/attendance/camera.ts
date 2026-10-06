import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'starting' | 'ready' | 'denied' | 'unavailable'

/** Enciende la camara frontal y la conecta a un <video>. Se apaga al desmontar. */
export function useCamera(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>('starting')

  useEffect(() => {
    if (!enabled) return
    let stream: MediaStream | null = null
    let cancelled = false
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
        if (!cancelled) setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [enabled])

  return { videoRef, status }
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
