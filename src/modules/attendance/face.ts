// Reconocimiento facial en el navegador con face-api (@vladmandic/face-api, trae
// tfjs incluido). Se importa dinamicamente: son ~1.5MB que solo descargan la
// pantalla de marcacion y el registro de empleados.
//
// Los modelos (~12MB) se sirven desde jsDelivr con la version fija del paquete
// instalado; la tablet los baja una vez y quedan en cache del navegador.

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

export type FaceBackendInfo = { backend: string; float32: boolean | null }

let loading: Promise<FaceApi> | null = null
let backendInfo: FaceBackendInfo | null = null

/** Backend con el que quedo corriendo la deteccion (para el diagnostico). */
export function faceBackend(): FaceBackendInfo | null {
  return backendInfo
}

/**
 * WASM primero: corre en CPU y da el mismo resultado en cualquier equipo
 * (~0.5 s por foto). WebGL es apenas mas rapido pero no es confiable: en una
 * tablet Android que reporta float32 la red devolvia cero caras sin lanzar
 * error. WebGL queda de respaldo si el navegador no soporta WASM, y cpu puro de
 * ultimo recurso. `?backend=webgl|cpu` en la URL fuerza uno (para probar).
 */
async function pickBackend(tf: Tf): Promise<FaceBackendInfo> {
  const forced = new URLSearchParams(window.location.search).get('backend')
  if (!forced || forced === 'wasm') {
    try {
      tf.setWasmPaths(WASM_URL)
      if (await tf.setBackend('wasm')) {
        await tf.ready()
        return { backend: 'wasm', float32: null }
      }
    } catch {
      // Sin WASM: sigue con WebGL.
    }
  }
  if (forced !== 'cpu') {
    try {
      if (await tf.setBackend('webgl')) {
        await tf.ready()
        return { backend: 'webgl', float32: tf.env().getBool('WEBGL_RENDER_FLOAT32_CAPABLE') }
      }
    } catch {
      // Sin WebGL: queda cpu.
    }
  }
  await tf.setBackend('cpu')
  await tf.ready()
  return { backend: 'cpu', float32: null }
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
export type DetectionStats = { faces: number; score: number | null; facePx: number | null }

export type DescribeResult =
  | { ok: true; descriptor: number[]; stats: DetectionStats }
  | { ok: false; reason: 'no-face' | 'multiple-faces' | 'too-far'; stats: DetectionStats }

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
  // 0.4 y no 0.5: luz de local y camaras frontales flojas de tablet. El umbral
  // que decide QUIEN es (match) es otro y no cambia.
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
  const results = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
  if (results.length === 0) return { ok: false, reason: 'no-face', stats: { faces: 0, score: null, facePx: null } }

  const largest = results.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a))
  const box = largest.detection.box
  const facePx = Math.round(Math.min(box.width, box.height))
  const stats = { faces: results.length, score: largest.detection.score, facePx }
  if (single && results.length > 1) return { ok: false, reason: 'multiple-faces', stats }
  if (facePx < MIN_FACE_PX) return { ok: false, reason: 'too-far', stats }
  return { ok: true, descriptor: Array.from(largest.descriptor), stats }
}

export const DESCRIBE_ERROR: Record<Exclude<DescribeResult, { ok: true }>['reason'], string> = {
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
