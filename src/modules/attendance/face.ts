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

type FaceApi = typeof import('@vladmandic/face-api')

let loading: Promise<FaceApi> | null = null

export function loadFaceApi(): Promise<FaceApi> {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      // El tipado de face-api no expone tf.ready(); en runtime existe y deja lista
      // la GPU (webgl) antes de cargar los modelos.
      await (faceapi.tf as unknown as { ready: () => Promise<void> }).ready()
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      return faceapi
    })()
    // Si falla (sin red), permitir reintentar en vez de cachear el error.
    loading.catch(() => { loading = null })
  }
  return loading
}

export type DescribeResult =
  | { ok: true; descriptor: number[] }
  | { ok: false; reason: 'no-face' | 'multiple-faces' | 'too-far' }

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
  const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
  const results = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
  if (results.length === 0) return { ok: false, reason: 'no-face' }
  if (single && results.length > 1) return { ok: false, reason: 'multiple-faces' }

  const largest = results.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a))
  const box = largest.detection.box
  if (Math.min(box.width, box.height) < MIN_FACE_PX) return { ok: false, reason: 'too-far' }
  return { ok: true, descriptor: Array.from(largest.descriptor) }
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
