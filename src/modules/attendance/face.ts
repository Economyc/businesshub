// Reconocimiento facial en el navegador con face-api (@vladmandic/face-api, trae
// tfjs incluido). Se importa dinamicamente: son ~1.5MB que solo descargan la
// pantalla de marcacion y el registro de empleados.
//
// Los modelos (~12MB) se sirven desde jsDelivr con la version fija del paquete
// instalado; la tablet los baja una vez y quedan en cache del navegador.

import { isBlankFrame } from './camera'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/'

/** Cara minima (en px del lado corto del recuadro) para aceptar la foto: mas
 *  pequena es alguien lejos de la camara y el descriptor sale poco confiable. */
const MIN_FACE_PX = 110

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
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
  try {
    await faceapi.detectAllFaces(canvas, options).withFaceLandmarks().withFaceDescriptors()
  } catch {
    // Si el calentamiento falla, la primera foto solo tarda mas.
  }
}

/** Lo que vio el detector, para el diagnostico de la pantalla de marcacion. */
export type DetectionStats = { faces: number; score: number | null; facePx: number | null; blank: boolean }

export type DescribeResult =
  | { ok: true; descriptor: number[]; stats: DetectionStats }
  | { ok: false; reason: 'blank-frame' | 'no-face' | 'multiple-faces' | 'too-far'; stats: DetectionStats }

type Detections = Awaited<ReturnType<typeof detect>>

async function detect(faceapi: FaceApi, input: HTMLCanvasElement) {
  // 0.4 y no 0.5: luz de local y camaras frontales flojas de tablet. El umbral
  // que decide QUIEN es (match) es otro y no cambia.
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
  return await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
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
 * - `single`: exige exactamente una cara (registro). Si no, toma la mas grande
 *   (marcacion: puede haber alguien pasando detras).
 */
export async function describeFace(
  input: HTMLCanvasElement,
  { single }: { single: boolean },
): Promise<DescribeResult> {
  const faceapi = await loadFaceApi()
  if (input.width === 0 || input.height === 0 || isBlankFrame(input)) {
    return { ok: false, reason: 'blank-frame', stats: { faces: 0, score: null, facePx: null, blank: true } }
  }
  const results = await detectWithFallback(faceapi, input)
  if (results.length === 0) return { ok: false, reason: 'no-face', stats: { faces: 0, score: null, facePx: null, blank: false } }

  const largest = results.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a))
  const box = largest.detection.box
  const facePx = Math.round(Math.min(box.width, box.height))
  const stats = { faces: results.length, score: largest.detection.score, facePx, blank: false }
  if (single && results.length > 1) return { ok: false, reason: 'multiple-faces', stats }
  if (facePx < MIN_FACE_PX) return { ok: false, reason: 'too-far', stats }
  return { ok: true, descriptor: Array.from(largest.descriptor), stats }
}

export const DESCRIBE_ERROR: Record<Exclude<DescribeResult, { ok: true }>['reason'], string> = {
  'blank-frame': 'La foto salió vacía: la cámara todavía no está lista. Intenta de nuevo.',
  'no-face': 'No se ve ninguna cara. Mira de frente a la cámara.',
  'multiple-faces': 'Hay más de una persona en la foto. Debe salir solo el empleado.',
  'too-far': 'Estás muy lejos. Acércate a la cámara.',
}

export function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}
