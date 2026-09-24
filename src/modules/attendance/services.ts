import { Timestamp, where, setDoc, deleteDoc, deleteField, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { getAppFunctions, getAppStorage } from '@/core/firebase/config'
import { companyDoc, createDocument, fetchCollection, updateDocument } from '@/core/firebase/helpers'
import type { AttendanceConfig, AttendancePunch, FaceProfile, KioskInfo, PunchResponse, PunchType } from './types'
import type { Novelty } from '@/modules/schedule/types'
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

  // ── Correcciones a mano (todas dejan quien y por que) ──
  addManualPunch: (
    companyId: string,
    data: { employeeId: string; employeeName: string; type: PunchType; at: Date; reason: string; by: string },
  ) =>
    createDocument(companyId, PUNCHES, {
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      type: data.type,
      at: Timestamp.fromDate(data.at),
      date: toBogotaDate(data.at),
      photoPath: '',
      source: 'manual',
      createdBy: data.by,
      reason: data.reason,
    }),

  editPunchTime: (companyId: string, punch: AttendancePunch, at: Date, reason: string, by: string) =>
    updateDocument(companyId, PUNCHES, punch.id, {
      at: Timestamp.fromDate(at),
      date: toBogotaDate(at),
      editedBy: by,
      editReason: reason,
      // Se conserva la hora de la primera version, no la de cada edicion.
      originalAt: punch.originalAt ?? punch.at,
    }),

  voidPunch: (companyId: string, punchId: string, reason: string, by: string) =>
    updateDocument(companyId, PUNCHES, punchId, { voided: true, voidedBy: by, voidReason: reason }),

  approveExtra: (companyId: string, inPunchId: string, by: string) =>
    updateDocument(companyId, PUNCHES, inPunchId, { extraApprovedBy: by, extraApprovedAt: Timestamp.now() }),

  revokeExtra: (companyId: string, inPunchId: string) =>
    updateDocument(companyId, PUNCHES, inPunchId, { extraApprovedBy: deleteField(), extraApprovedAt: deleteField() }),

  getNoveltiesByRange: (companyId: string, from: string, to: string) =>
    fetchCollection<Novelty>(companyId, 'novelties', where('date', '>=', from), where('date', '<=', to)),

  getConfig: async (companyId: string): Promise<AttendanceConfig> => {
    const snap = await getDoc(companyDoc(companyId, 'attendanceConfig', 'main'))
    return { scheduleOnlyEmployeeIds: [], ...(snap.data() as Partial<AttendanceConfig> | undefined) }
  },

  saveConfig: (companyId: string, config: AttendanceConfig) =>
    setDoc(companyDoc(companyId, 'attendanceConfig', 'main'), config, { merge: true }),

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

  /** Despierta la funcion de marcar (sin registrar nada) para que la foto del
   *  empleado no pague el arranque en frio. */
  warmPunch: async (token: string): Promise<void> => {
    const fns = await getAppFunctions()
    await httpsCallable<{ token: string; warm: true }, unknown>(fns, 'attendancePunch')({ token, warm: true })
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

/** Fecha 'YYYY-MM-DD' + hora 'HH:mm' en hora de Colombia -> Date. */
export function bogotaDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-05:00`)
}
