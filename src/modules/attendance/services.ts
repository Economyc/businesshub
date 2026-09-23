import { Timestamp, where, setDoc, deleteDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { getAppFunctions, getAppStorage } from '@/core/firebase/config'
import { companyDoc, fetchCollection } from '@/core/firebase/helpers'
import type { AttendancePunch, FaceProfile, KioskInfo, PunchResponse } from './types'

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

  getPunchesByDate: (companyId: string, date: string) =>
    fetchCollection<AttendancePunch>(companyId, PUNCHES, where('date', '==', date)),

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

/** Fecha de hoy 'YYYY-MM-DD' en hora de Colombia (igual que la guarda el servidor). */
export function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function formatTimeBogota(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
}
