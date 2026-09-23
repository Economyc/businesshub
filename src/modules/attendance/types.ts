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
  distance: number
  photoPath: string
  source: 'face'
}

export interface KioskInfo {
  companyName: string
  logo: string | null
  logoThumb: string | null
  color: string | null
}

export type PunchResponse =
  | { matched: false }
  | { matched: true; duplicate: boolean; employeeName: string; type: PunchType; at: string }
