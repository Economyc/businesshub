// Logica pura de la marcacion por reconocimiento facial (sin Firestore), para
// poder probarla aislada. El navegador calcula el descriptor de la cara con
// face-api (vector de 128 numeros) y aqui se compara contra los perfiles
// registrados del local.

/** Distancia euclidiana maxima para aceptar que dos caras son la misma persona.
 *  0.6 es el umbral clasico de face-api; 0.5 es mas estricto y es el que se usa
 *  con una sola selfie de registro para no confundir gente parecida. */
export const MATCH_MAX_DISTANCE = 0.5

/** El segundo candidato tiene que quedar al menos esta distancia mas lejos. Si
 *  dos empleados quedan casi empatados, no se marca a ninguno. */
export const MATCH_MIN_MARGIN = 0.06

/** Por debajo de esta distancia la marcacion es tan clara que el descriptor se
 *  guarda como referencia extra del empleado (aprende luz, barba, gorra...). */
export const LEARN_MAX_DISTANCE = 0.4

/** Referencias guardadas por empleado: la selfie de registro + las aprendidas. */
export const MAX_DESCRIPTORS = 6

/** Dos marcaciones del mismo empleado dentro de esta ventana se toman como una. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000

/** Si la ultima marcacion fue una entrada hace mas de esto, se asume que olvido
 *  marcar la salida y la nueva vuelve a ser entrada. Cubre turnos que cruzan la
 *  medianoche sin confundir dias distintos. */
export const OPEN_SHIFT_MAX_MS = 18 * 60 * 60 * 1000

export const DESCRIPTOR_LENGTH = 128

export type PunchType = 'in' | 'out'

export interface FaceCandidate {
  employeeId: string
  employeeName: string
  descriptors: number[][]
}

export interface MatchResult {
  employeeId: string
  employeeName: string
  distance: number
}

export function euclidean(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i]
    sum += d * d
  }
  return Math.sqrt(sum)
}

export function isValidDescriptor(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === DESCRIPTOR_LENGTH &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
}

/** Mejor coincidencia de cada empleado (su referencia mas cercana) y decision
 *  final. Devuelve null si nadie pasa el umbral o si hay empate. */
export function findMatch(probe: number[], candidates: FaceCandidate[]): MatchResult | null {
  const ranked = candidates
    .filter((c) => c.descriptors.length > 0)
    .map((c) => ({
      employeeId: c.employeeId,
      employeeName: c.employeeName,
      distance: Math.min(...c.descriptors.map((d) => euclidean(probe, d))),
    }))
    .sort((a, b) => a.distance - b.distance)

  const best = ranked[0]
  if (!best || best.distance > MATCH_MAX_DISTANCE) return null
  const second = ranked[1]
  if (second && second.distance - best.distance < MATCH_MIN_MARGIN) return null
  return best
}

/** Entrada o salida segun la ultima marcacion del empleado. */
export function nextPunchType(
  last: { type: PunchType; atMs: number } | null,
  nowMs: number,
): PunchType {
  if (!last) return 'in'
  if (last.type === 'in' && nowMs - last.atMs <= OPEN_SHIFT_MAX_MS) return 'out'
  return 'in'
}

export function isDuplicate(last: { atMs: number } | null, nowMs: number): boolean {
  return !!last && nowMs - last.atMs < DUPLICATE_WINDOW_MS
}

/** Agrega un descriptor aprendido. La posicion 0 (selfie de registro) nunca se
 *  descarta; entre las aprendidas sale la mas vieja. */
export function learnDescriptor(descriptors: number[][], probe: number[]): number[][] {
  if (descriptors.length === 0) return [probe]
  const [enrolled, ...learned] = descriptors
  const next = [...learned, probe].slice(-(MAX_DESCRIPTORS - 1))
  return [enrolled, ...next]
}
