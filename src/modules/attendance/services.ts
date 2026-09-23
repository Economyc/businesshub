import { Timestamp, where, setDoc, deleteDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { getAppFunctions, getAppStorage } from '@/core/firebase/config'
import { companyDoc, fetchCollection } from '@/core/firebase/helpers'
import type { AttendancePunch, FaceProfile, KioskInfo, PunchResponse } from './types'
import type { ScheduledShift } from './shifts'

const PROFILES = 'faceProfiles'
const PUNCHES = 'attendancePunches'

export const attendanceService = {
  getProfiles: (companyId: string) => fetchCollection<FaceProfile>(companyId, PROFILES),

  /** Registro (o re-registro) de un empleado: reemplaza sus referencias por la
   *  selfie nueva, asi que tambien descarta las que el sistema habia aprendido. */
  enroll: async (
    companyId: string,
    employeeId: string,
    data: { employeeName: string; descriptor: number[]; thumb: string },
  ): Promise<void> => {
    await setDoc(companyDoc(companyId, PROFILES, employeeId), {
      employeeName: data.employeeName,
      descriptors: [{ v: data.descriptor }],
      thumb: data.thumb,
      enrolledAt: Timestamp.now(),
    }, { merge: true })
  },

  removeProfile: (companyId: string, employeeId: string) =>
    deleteDoc(companyDoc(companyId, PROFILES, employeeId)),

  /** Marcaciones entre dos fechas 'YYYY-MM-DD' (inclusive). Rango sobre un solo
   *  campo: no necesita indice compuesto. El filtro por empleado va en el cliente. */
  getPunchesByRange: (companyId: string, from: string, to: string) =>
    fetchCollection<AttendancePunch>(companyId, PUNCHES, where('date', '>=', from), where('date', '<=', to)),

  /** Turnos programados en Horarios entre dos fechas, para medir puntualidad. */
  getScheduledShifts: (companyId: string, from: string, to: string) =>
    fetchCollection<ScheduledShift>(companyId, 'shifts', where('date', '>=', from), where('date', '<=', to)),

  photoUrl: async (path: string): Promise<string> => {
    const storage = await getAppStorage()
    return getDownloadURL(storageRef(storage, path))
  },

  kioskLink: async (companyId: string, rotate = false): Promise<string> => {
    const fns = await getAppFunctions()
    const fn = httpsCallable<{ companyId: string; rotate: boolean }, { token: string }>(fns, 'attendanceKioskLink')
    const { data } = await fn({ companyId, rotate })
    return data.token
  },

  // ── Link publico (sin sesion) ──
  kioskInfo: async (token: string): Promise<KioskInfo> => {
    const fns = await getAppFunctions()
    const fn = httpsCallable<{ token: string }, KioskInfo>(fns, 'attendanceKioskInfo')
    return (await fn({ token })).data
  },

  punch: async (token: string, descriptor: number[], photoBase64: string): Promise<PunchResponse> => {
    const fns = await getAppFunctions()
    const fn = httpsCallable<{ token: string; descriptor: number[]; photoBase64: string }, PunchResponse>(
      fns,
      'attendancePunch',
    )
    return (await fn({ token, descriptor, photoBase64 })).data
  },
}

/** 'YYYY-MM-DD' en hora de Colombia (igual que la guarda el servidor). */
export function toBogotaDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export function todayBogota(): string {
  return toBogotaDate(new Date())
}

export function formatTimeBogota(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
}
