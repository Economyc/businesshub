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
}

/** Configuracion de marcacion del local (doc `attendanceConfig/main`). */
export interface AttendanceConfig {
  /** Empleados que no marcan y se liquidan por su horario programado (jefes). */
  scheduleOnlyEmployeeIds: string[]
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
  | { matched: true; duplicate: boolean; employeeName: string; type: PunchType; at: string }
