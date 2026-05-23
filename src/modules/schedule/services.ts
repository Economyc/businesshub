import { Timestamp, where, orderBy, getDoc, setDoc } from 'firebase/firestore'
import {
  fetchCollection,
  createDocument,
  updateDocument,
  removeDocument,
  companyDoc,
} from '@/core/firebase/helpers'
import type {
  Shift,
  ShiftFormData,
  ScheduleWeek,
  WeekStatus,
  ShiftTemplate,
  ShiftTemplateFormData,
} from './types'

const SHIFTS = 'shifts'
const WEEKS = 'scheduleWeeks'
const TEMPLATES = 'shiftTemplates'

export const scheduleService = {
  // ── Shifts ──
  getShiftsByWeek: (companyId: string, weekKey: string) =>
    fetchCollection<Shift>(companyId, SHIFTS, where('weekKey', '==', weekKey)),

  createShift: (companyId: string, data: ShiftFormData) =>
    createDocument(companyId, SHIFTS, data),

  updateShift: (companyId: string, id: string, data: Partial<ShiftFormData>) =>
    updateDocument(companyId, SHIFTS, id, data),

  removeShift: (companyId: string, id: string) => removeDocument(companyId, SHIFTS, id),

  /** Clona los turnos de `fromWeekKey` a `toWeekKey` (con sus fechas trasladadas +7 días). */
  copyWeek: async (
    companyId: string,
    fromShifts: Shift[],
    toWeekKey: string,
    dateMap: Record<string, string>,
  ): Promise<void> => {
    await Promise.all(
      fromShifts.map((s) => {
        const data: ShiftFormData = {
          weekKey: toWeekKey,
          date: dateMap[s.date] ?? s.date,
          employeeId: s.employeeId,
          start: s.start,
          end: s.end,
          ...(s.role ? { role: s.role } : {}),
          ...(s.breakMin != null ? { breakMin: s.breakMin } : {}),
          ...(s.notes ? { notes: s.notes } : {}),
        }
        return createDocument(companyId, SHIFTS, data)
      }),
    )
  },

  // ── Week status ──
  getWeek: async (companyId: string, weekKey: string): Promise<ScheduleWeek> => {
    const ref = companyDoc(companyId, WEEKS, weekKey)
    const snap = await getDoc(ref)
    if (!snap.exists()) return { weekKey, status: 'draft' }
    return { weekKey, ...(snap.data() as Omit<ScheduleWeek, 'weekKey'>) }
  },

  setWeekStatus: async (
    companyId: string,
    weekKey: string,
    status: WeekStatus,
    userEmail?: string,
  ): Promise<void> => {
    const ref = companyDoc(companyId, WEEKS, weekKey)
    await setDoc(
      ref,
      {
        status,
        ...(status === 'published'
          ? { publishedAt: Timestamp.now(), publishedBy: userEmail ?? '' }
          : {}),
      },
      { merge: true },
    )
  },

  // ── Templates ──
  getTemplates: (companyId: string) =>
    fetchCollection<ShiftTemplate>(companyId, TEMPLATES, orderBy('start', 'asc')),

  createTemplate: (companyId: string, data: ShiftTemplateFormData) =>
    createDocument(companyId, TEMPLATES, data),

  removeTemplate: (companyId: string, id: string) => removeDocument(companyId, TEMPLATES, id),
}
