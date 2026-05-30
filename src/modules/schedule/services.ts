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
  Novelty,
  NoveltyFormData,
  NoveltyType,
  NoveltyTypeFormData,
} from './types'

const SHIFTS = 'shifts'
const WEEKS = 'scheduleWeeks'
const TEMPLATES = 'shiftTemplates'
const NOVELTIES = 'novelties'
const NOVELTY_TYPES = 'noveltyTypes'

export const scheduleService = {
  // ── Shifts ──
  getShiftsByWeek: (companyId: string, weekKey: string) =>
    fetchCollection<Shift>(companyId, SHIFTS, where('weekKey', '==', weekKey)),

  createShift: (companyId: string, data: ShiftFormData) =>
    createDocument(companyId, SHIFTS, data),

  updateShift: (companyId: string, id: string, data: Partial<ShiftFormData>) =>
    updateDocument(companyId, SHIFTS, id, data),

  removeShift: (companyId: string, id: string) => removeDocument(companyId, SHIFTS, id),

  /** Borra todos los turnos y novedades de una semana (usado al reemplazar al replicar). */
  clearWeek: async (companyId: string, weekKey: string): Promise<void> => {
    const [shifts, novelties] = await Promise.all([
      fetchCollection<Shift>(companyId, SHIFTS, where('weekKey', '==', weekKey)),
      fetchCollection<Novelty>(companyId, NOVELTIES, where('weekKey', '==', weekKey)),
    ])
    await Promise.all([
      ...shifts.map((s) => removeDocument(companyId, SHIFTS, s.id)),
      ...novelties.map((n) => removeDocument(companyId, NOVELTIES, n.id)),
    ])
  },

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

  // ── Novelties (novedades aplicadas en la grilla) ──
  getNoveltiesByWeek: (companyId: string, weekKey: string) =>
    fetchCollection<Novelty>(companyId, NOVELTIES, where('weekKey', '==', weekKey)),

  createNovelty: (companyId: string, data: NoveltyFormData) =>
    createDocument(companyId, NOVELTIES, data),

  updateNovelty: (companyId: string, id: string, data: Partial<NoveltyFormData>) =>
    updateDocument(companyId, NOVELTIES, id, data),

  removeNovelty: (companyId: string, id: string) => removeDocument(companyId, NOVELTIES, id),

  /** Clona las novedades de una semana a `toWeekKey` (con sus fechas trasladadas). */
  copyNovelties: async (
    companyId: string,
    fromNovelties: Novelty[],
    toWeekKey: string,
    dateMap: Record<string, string>,
  ): Promise<void> => {
    await Promise.all(
      fromNovelties.map((n) => {
        const data: NoveltyFormData = {
          weekKey: toWeekKey,
          date: dateMap[n.date] ?? n.date,
          employeeId: n.employeeId,
          typeId: n.typeId,
          typeName: n.typeName,
          color: n.color,
          ...(n.notes ? { notes: n.notes } : {}),
        }
        return createDocument(companyId, NOVELTIES, data)
      }),
    )
  },

  // ── Novelty types (catálogo, solo lo gestiona el Owner) ──
  getNoveltyTypes: (companyId: string) =>
    fetchCollection<NoveltyType>(companyId, NOVELTY_TYPES, orderBy('name', 'asc')),

  createNoveltyType: (companyId: string, data: NoveltyTypeFormData) =>
    createDocument(companyId, NOVELTY_TYPES, data),

  removeNoveltyType: (companyId: string, id: string) =>
    removeDocument(companyId, NOVELTY_TYPES, id),
}
