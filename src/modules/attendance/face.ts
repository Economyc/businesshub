// Reconocimiento facial en el navegador con face-api (@vladmandic/face-api, trae
// tfjs incluido). Se importa dinamicamente: son ~1.5MB que solo descargan la
// pantalla de marcacion y el registro de empleados.
//
// Los modelos (~12MB) se sirven desde jsDelivr con la version fija del paquete
// instalado; la tablet los baja una vez y quedan en cache del navegador.

import { fitCanvas, isBlankFrame, meanLuma } from './camera'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/'

/** Cara minima en px de la CAMARA (lado corto del recuadro). Antes eran 110 px
 *  medidos sobre la foto reducida a 640, que en una tablet a distancia normal
 *  no se alcanzaba ("Estas muy lejos"). Como el descriptor sale de un recorte
 *  a resolucion completa, 80 px de camara alcanzan. */
export const MIN_FACE_PX = 80

/** Lado de la foto donde se busca la cara (rapido) y del recorte cuadrado de
 *  donde sale el descriptor. Tamanos fijos: tfjs acumula memoria si cada
 *  inferencia llega con un tamano distinto, y el kiosco pasa dias abierto. */
const DETECT_SIDE = 640
const CHIP_SIDE = 320
/** El recorte toma la cara y su contorno (frente, menton, orejas). */
const CHIP_FACE_RATIO = 2.2

/** Brillo medio (0-255) de la cara por debajo del cual la foto no sirve. */
export const DARK_LUMA = 55

/** Binarios del backend WASM, con la version de tfjs que trae face-api 1.7.15. */
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/'

type FaceApi = typeof import('@vladmandic/face-api')

// El tipado de face-api no expone estas funciones de tfjs; en runtime existen.
type Tf = {
  ready: () => Promise<void>
  setBackend: (name: string) => Promise<boolean>
  getBackend: () => string
  setWasmPaths: (prefix: string) => void
  env: () => { getBool: (flag: string) => boolean }
}

type Backend = 'wasm' | 'webgl' | 'cpu'

/**
 * WASM primero: corre en CPU y da el mismo resultado en cualquier equipo
 * (~0.5 s por foto). WebGL es apenas mas rapido pero no es confiable: en una
 * tablet Android que reporta float32 la red devolvia cero caras sin lanzar
 * error. cpu puro es el ultimo recurso. `?backend=webgl|cpu|wasm` en la URL
 * fuerza uno (para probar).
 */
const BACKENDS: Backend[] = ['wasm', 'webgl', 'cpu']

/** Motor que le funciono a este equipo la ultima vez (ver `describeFace`). */
const BACKEND_KEY = 'attendance.faceBackend'

export type FaceBackendInfo = { backend: string; float32: boolean | null; fallbackFrom: string | null }

let loading: Promise<FaceApi> | null = null
/** El modulo ya cargado (para leer la memoria de tfjs sin esperar). */
let loaded: FaceApi | null = null
let backendInfo: FaceBackendInfo | null = null
/** Motores que ya se probaron sin encontrar cara en esta sesion. */
const failedBackends = new Set<string>()
/** Probar los otros motores tarda ~10 s (cpu es lento). Si dos rondas no
 *  encontraron nada, el problema no es el motor: no se repite en cada foto. */
const MAX_FALLBACK_ROUNDS = 2
let fallbackRounds = 0

/** Backend con el que quedo corriendo la deteccion (para el diagnostico). */
export function faceBackend(): FaceBackendInfo | null {
  return backendInfo
}

function forcedBackend(): Backend | null {
  const forced = new URLSearchParams(window.location.search).get('backend')
  return BACKENDS.find((b) => b === forced) ?? null
}

function rememberedBackend(): Backend | null {
  try {
    const saved = localStorage.getItem(BACKEND_KEY)
    return BACKENDS.find((b) => b === saved) ?? null
  } catch {
    return null
  }
}

function rememberBackend(name: string) {
  try {
    localStorage.setItem(BACKEND_KEY, name)
  } catch {
    // Sin almacenamiento: la proxima sesion vuelve a probar desde WASM.
  }
}

let wasmPathsSet = false

async function activate(tf: Tf, name: Backend): Promise<FaceBackendInfo | null> {
  try {
    if (name === 'wasm' && !wasmPathsSet) {
      tf.setWasmPaths(WASM_URL)
      wasmPathsSet = true
    }
    if (!(await tf.setBackend(name))) return null
    await tf.ready()
    const float32 = name === 'webgl' ? tf.env().getBool('WEBGL_RENDER_FLOAT32_CAPABLE') : null
    return { backend: name, float32, fallbackFrom: null }
  } catch {
    return null
  }
}

async function pickBackend(tf: Tf): Promise<FaceBackendInfo> {
  const forced = forcedBackend()
  const remembered = rememberedBackend()
  const order = forced ? [forced, 'cpu' as const] : [...new Set([...(remembered ? [remembered] : []), ...BACKENDS])]
  for (const name of order) {
    const info = await activate(tf, name)
    if (info) return info
  }
  throw new Error('Sin motor de deteccion disponible')
}

export function loadFaceApi(): Promise<FaceApi> {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      backendInfo = await pickBackend(faceapi.tf as unknown as Tf)
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      await warmUp(faceapi)
      loaded = faceapi
      return faceapi
    })()
    // Si falla (sin red), permitir reintentar en vez de cachear el error.
    loading.catch(() => { loading = null })
  }
  return loading
}

/** La primera inferencia prepara el backend (kernels de WASM o shaders de
 *  WebGL) y tarda varios segundos.
 *  Se paga aqui, mientras la pantalla dice "Preparando…", y no en la primera
 *  foto. Con un canvas en blanco no hay cara, pero la red corre completa. */
async function warmUp(faceapi: FaceApi): Promise<void> {
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
  try {
    // Los dos tamanos que se usan: la foto reducida y el recorte de la cara.
    await faceapi.detectAllFaces(grayCanvas(DETECT_SIDE, Math.round((DETECT_SIDE * 3) / 4)), options)
    await faceapi.detectSingleFace(grayCanvas(CHIP_SIDE, CHIP_SIDE), options).withFaceLandmarks().withFaceDescriptor()
  } catch {
    // Si el calentamiento falla, la primera foto solo tarda mas.
  }
}

function grayCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, width, height)
  return canvas
}

/** Tensores vivos de tfjs (null si los modelos no han cargado). Si crece sin
 *  parar hay una fuga y el kiosco se recarga solo. */
export function tensorCount(): number | null {
  const tf = loaded?.tf as unknown as { memory?: () => { numTensors: number } } | undefined
  try {
    return tf?.memory?.().numTensors ?? null
  } catch {
    return null
  }
}

/** Lo que vio el detector, para el diagnostico y la telemetria del kiosco.
 *  `facePx` va en px de la camara; `brightness` es el brillo medio de la cara
 *  (o de toda la foto si no hubo cara). */
export type DetectionStats = {
  faces: number
  score: number | null
  facePx: number | null
  blank: boolean
  brightness: number | null
}

export type DescribeFailure = 'blank-frame' | 'no-face' | 'multiple-faces' | 'too-far' | 'dark'

export type DescribeResult =
  | { ok: true; descriptor: number[]; stats: DetectionStats }
  | { ok: false; reason: DescribeFailure; stats: DetectionStats }

type Detections = Awaited<ReturnType<typeof detect>>

// 0.4 y no 0.5: luz de local y camaras frontales flojas de tablet. El umbral
// que decide QUIEN es (match) es otro y no cambia.
const MIN_CONFIDENCE = 0.4

/** Solo ubica caras (sin landmarks ni descriptor): es lo que se corre sobre la
 *  foto reducida. */
async function detect(faceapi: FaceApi, input: HTMLCanvasElement) {
  return await faceapi.detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
}

/**
 * Cero caras en una foto que si tiene imagen puede ser el motor fallando en
 * silencio (WebGL en una tablet Android, WASM en un iPhone). Se prueba la misma
 * foto con los otros motores; si uno encuentra cara, queda activo y se recuerda
 * para este equipo. Si ninguno ve cara, era de verdad que no habia y se vuelve
 * al motor original. Con `?backend=` forzado no se cambia nada.
 */
async function detectWithFallback(faceapi: FaceApi, input: HTMLCanvasElement): Promise<Detections> {
  const results = await detect(faceapi, input)
  if (results.length > 0 || forcedBackend() || !backendInfo || fallbackRounds >= MAX_FALLBACK_ROUNDS) return results

  fallbackRounds += 1
  const tf = faceapi.tf as unknown as Tf
  const original = backendInfo
  failedBackends.add(original.backend)
  for (const name of BACKENDS) {
    if (failedBackends.has(name)) continue
    const info = await activate(tf, name)
    if (!info) {
      failedBackends.add(name)
      continue
    }
    const retry = await detect(faceapi, input).catch(() => [] as Detections)
    if (retry.length > 0) {
      backendInfo = { ...info, fallbackFrom: original.fallbackFrom ?? original.backend }
      rememberBackend(name)
      failedBackends.clear()
      fallbackRounds = 0
      return retry
    }
    failedBackends.add(name)
  }
  // Nadie vio cara: volver al motor de antes y permitir reintentar los demas en
  // la proxima foto (puede que esta de verdad no tuviera a nadie).
  await activate(tf, original.backend as Backend)
  failedBackends.clear()
  return results
}

/**
 * Detecta la cara y calcula su descriptor (128 numeros).
 *
 * `input` es la foto a resolucion completa. La cara se busca en una copia
 * reducida a DETECT_SIDE (rapido) y el descriptor se calcula sobre un recorte
 * cuadrado de la cara tomado de la foto completa: una cara chica en la copia
 * reducida sigue teniendo detalle suficiente en la original.
 * - `single`: exige exactamente una cara (registro). Si no, toma la mas grande
 *   (marcacion: puede haber alguien pasando detras).
 */
export async function describeFace(
  input: HTMLCanvasElement,
  { single }: { single: boolean },
): Promise<DescribeResult> {
  const faceapi = await loadFaceApi()
  const empty: DetectionStats = { faces: 0, score: null, facePx: null, blank: true, brightness: null }
  if (input.width === 0 || input.height === 0) return { ok: false, reason: 'blank-frame', stats: empty }
  const small = fitCanvas(input, DETECT_SIDE)
  if (isBlankFrame(small)) return { ok: false, reason: 'blank-frame', stats: empty }

  const found = await detectWithFallback(faceapi, small)
  if (found.length === 0) {
    const brightness = Math.round(meanLuma(small, 0, 0, small.width, small.height))
    const stats = { ...empty, blank: false, brightness }
    return { ok: false, reason: brightness < DARK_LUMA ? 'dark' : 'no-face', stats }
  }

  const largest = found.reduce((a, b) => (b.box.area > a.box.area ? b : a))
  const scale = input.width / small.width
  const box = { x: largest.box.x * scale, y: largest.box.y * scale, width: largest.box.width * scale, height: largest.box.height * scale }
  const facePx = Math.round(Math.min(box.width, box.height))
  const brightness = Math.round(meanLuma(input, box.x + box.width * 0.2, box.y + box.height * 0.2, box.width * 0.6, box.height * 0.6))
  const stats: DetectionStats = { faces: found.length, score: largest.score, facePx, blank: false, brightness }
  if (single && found.length > 1) return { ok: false, reason: 'multiple-faces', stats }
  if (facePx < MIN_FACE_PX) return { ok: false, reason: 'too-far', stats }
  if (brightness < DARK_LUMA) return { ok: false, reason: 'dark', stats }

  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE })
  const chip = faceChip(input, box)
  const described =
    (await faceapi.detectSingleFace(chip, options).withFaceLandmarks().withFaceDescriptor()) ??
    // Si en el recorte no la vuelve a encontrar (borde de la imagen), la foto reducida.
    (await faceapi.detectSingleFace(small, options).withFaceLandmarks().withFaceDescriptor())
  if (!described) return { ok: false, reason: 'no-face', stats }
  return { ok: true, descriptor: Array.from(described.descriptor), stats }
}

/** Recorte cuadrado de CHIP_SIDE px centrado en la cara. Lo que cae fuera de
 *  la foto queda gris (se recorta a mano: Safari viejo no acepta un origen
 *  fuera de la imagen en drawImage). */
function faceChip(input: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
  const side = Math.max(box.width, box.height) * CHIP_FACE_RATIO
  const sx = box.x + box.width / 2 - side / 2
  const sy = box.y + box.height / 2 - side / 2
  const chip = grayCanvas(CHIP_SIDE, CHIP_SIDE)
  const k = CHIP_SIDE / side
  const x0 = Math.max(0, sx)
  const y0 = Math.max(0, sy)
  const x1 = Math.min(input.width, sx + side)
  const y1 = Math.min(input.height, sy + side)
  if (x1 > x0 && y1 > y0) {
    chip.getContext('2d')!.drawImage(input, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k)
  }
  return chip
}

export const DESCRIBE_ERROR: Record<DescribeFailure, string> = {
  'blank-frame': 'La foto salió vacía: la cámara todavía no está lista. Intenta de nuevo.',
  'no-face': 'No se ve ninguna cara. Mira de frente a la cámara.',
  'multiple-faces': 'Hay más de una persona en la foto. Debe salir solo el empleado.',
  'too-far': 'Estás un poco lejos. Acércate un paso a la cámara.',
  dark: 'Hay muy poca luz en tu cara. Ponte de frente a una luz e intenta de nuevo.',
}

// ── Guia en vivo ────────────────────────────────────────────────────────────
// Un detector chico (Tiny Face Detector, ~190 KB) corre cada poco sobre el
// video para decirle al empleado si esta lejos o descentrado ANTES de tocar el
// boton. No reconoce a nadie: solo ubica la cara.

const GUIDE_SIDE = 320
let tinyLoading: Promise<boolean> | null = null
let guideCanvas: HTMLCanvasElement | null = null

function loadTinyDetector(faceapi: FaceApi): Promise<boolean> {
  if (!tinyLoading) {
    tinyLoading = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).then(() => true)
    tinyLoading.catch(() => { tinyLoading = null })
  }
  return tinyLoading
}

export type FaceHint = 'none' | 'far' | 'off-center' | 'ok'

/** Donde esta la cara en el video ahora. null si la guia no esta disponible. */
export async function quickFaceHint(video: HTMLVideoElement): Promise<FaceHint | null> {
  const faceapi = loaded
  if (!faceapi || !video.videoWidth) return null
  await loadTinyDetector(faceapi)
  // Canvas reutilizado y de tamano fijo (memoria de tfjs estable).
  const scale = GUIDE_SIDE / Math.max(video.videoWidth, video.videoHeight)
  const w = Math.round(video.videoWidth * scale)
  const h = Math.round(video.videoHeight * scale)
  if (!guideCanvas || guideCanvas.width !== w || guideCanvas.height !== h) {
    guideCanvas = document.createElement('canvas')
    guideCanvas.width = w
    guideCanvas.height = h
  }
  guideCanvas.getContext('2d')!.drawImage(video, 0, 0, w, h)
  const det = await faceapi.detectSingleFace(guideCanvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
  if (!det) return 'none'
  const { box } = det
  // Algo de margen sobre el minimo: la foto real se toma un instante despues.
  if (Math.min(box.width, box.height) / scale < MIN_FACE_PX * 1.15) return 'far'
  const cx = (box.x + box.width / 2) / w
  const cy = (box.y + box.height / 2) / h
  if (Math.abs(cx - 0.5) > 0.22 || Math.abs(cy - 0.5) > 0.25) return 'off-center'
  return 'ok'
}

export function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}
