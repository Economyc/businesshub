import type { Timestamp } from 'firebase/firestore'

export type PunchType = 'in' | 'out'

export const PUNCH_TYPE_LABEL: Record<PunchType, string> = {
  in: 'Entrada',
  out: 'Salida',
}

/** Perfil facial de un empleado. Doc id = employeeId. Firestore no admite
 *  arrays anidados, por eso cada descriptor va envuelto en `{ v }`. La posicion
 *  0 es la selfie de registro; las siguientes las aprende el servidor al marcar. */
export interface FaceProfile {
  id: string
  employeeName: string
  descriptors: { v: number[] }[]
  /** Miniatura JPEG en data URL (~96px) para verificar a quien se registro. */
  thumb: string
  enrolledAt: Timestamp
  /** Cuantas de `descriptors` (las primeras) son fotos de registro. Sin el
   *  campo, una (registros de antes de la toma de varias fotos). */
  enrolledCount?: number
  /** Promedio movil de la distancia con la que marca (lo escribe el servidor).
   *  Alto = el sistema lo reconoce con dificultad. */
  recentDistance?: number
  lastPunchType?: PunchType
  lastPunchAt?: Timestamp
}

export interface AttendancePunch {
  id: string
  employeeId: string
  employeeName: string
  type: PunchType
  at: Timestamp
  /** 'YYYY-MM-DD' en hora de Colombia. */
  date: string
  /** Solo en marcaciones por cara. */
  distance?: number
  /** Vacio en las manuales (no hay foto). */
  photoPath: string
  /** 'face': tablet. 'manual': agregada por un admin desde el panel. */
  source: 'face' | 'manual'
  /** Quien la agrego (manual) y por que. */
  createdBy?: string
  reason?: string
  /** Hora corregida por un admin: la original queda en `originalAt`. */
  editedBy?: string
  editReason?: string
  originalAt?: Timestamp
  /** Anulada (p.ej. marco quien no era). No cuenta en jornadas ni en nomina,
   *  pero no se borra: queda como rastro. */
  voided?: boolean
  voidedBy?: string
  voidReason?: string
  /** Solo en la ENTRADA de una jornada: un admin aprobo pagar todo lo marcado,
   *  incluido lo que cae fuera del turno programado. */
  extraApprovedBy?: string
  extraApprovedAt?: Timestamp
  /** Salida que el kiosco registro sin entrada (olvido marcar al llegar): no se
   *  empareja con una entrada anterior que haya quedado abierta. */
  missedIn?: boolean
  /** Corregida por el empleado en el kiosco ("No, es mi entrada/salida"). */
  flippedFrom?: PunchType
}

/** Configuracion de marcacion del local (doc `attendanceConfig/main`). */
export interface AttendanceConfig {
  /** Empleados que no marcan y se liquidan por su horario programado (jefes). */
  scheduleOnlyEmployeeIds: string[]
}

/** Lo que vio el kiosco en un intento (diagnostico; el servidor solo guarda
 *  estos campos). */
export interface KioskClientStats {
  reason?: string
  faces?: number
  score?: number
  facePx?: number
  brightness?: number
  /** Resolucion del video, 'ancho x alto'. */
  video?: string
  backend?: string
  tensors?: number
  uptimeMin?: number
  /** Fotos de la rafaga que se analizaron. */
  frames?: number
  /** Cuanto tardo el analisis en el navegador. */
  ms?: number
}

/** Perfil que conviene volver a registrar: el sistema lo reconoce al limite. */
export function isWeakProfile(p: Pick<FaceProfile, 'descriptors' | 'recentDistance'>): boolean {
  const d = p.recentDistance
  if (d == null) return false
  return d > 0.46 || (p.descriptors.length <= 2 && d > 0.42)
}

export interface KioskInfo {
  companyName: string
  /** Sede (campo `location` de la company). */
  location: string | null
  logo: string | null
  logoThumb: string | null
  color: string | null
}

export type PunchResponse =
  | { matched: false }
  | {
      matched: true
      duplicate: boolean
      employeeName: string
      type: PunchType
      at: string
      /** Marcacion nueva: se puede corregir entrada/salida desde el kiosco. */
      punchId?: string | null
    }
