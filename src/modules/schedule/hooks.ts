import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { scheduleService } from './services'
import type {
  ShiftFormData,
  ShiftTemplateFormData,
  NoveltyFormData,
  NoveltyTypeFormData,
} from './types'

const STALE_MS = 5 * 60 * 1000

export function useShifts(weekKey: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'shifts', weekKey],
    queryFn: () => scheduleService.getShiftsByWeek(companyId!, weekKey),
    enabled: !!companyId && !!weekKey,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, error: error as Error | null, refetch }
}

export function useScheduleWeek(weekKey: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'scheduleWeeks', weekKey],
    queryFn: () => scheduleService.getWeek(companyId!, weekKey),
    enabled: !!companyId && !!weekKey,
    staleTime: STALE_MS,
  })

  return {
    week: data ?? { weekKey, status: 'draft' as const },
    loading: isLoading,
    refetch,
  }
}

export function useShiftTemplates() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'shiftTemplates'],
    queryFn: () => scheduleService.getTemplates(companyId!),
    enabled: !!companyId,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, refetch }
}

// Mutations CRUD. `useFirestoreMutation` invalida `['firestore', cid, 'shifts']`,
// que por prefix-match cubre también las queries scopeadas por weekKey.
export function useCreateShift() {
  return useFirestoreMutation<ShiftFormData, string>('shifts', (cid, data) =>
    scheduleService.createShift(cid, data),
  )
}

export function useUpdateShift() {
  return useFirestoreMutation<{ id: string; data: Partial<ShiftFormData> }>(
    'shifts',
    (cid, { id, data }) => scheduleService.updateShift(cid, id, data),
  )
}

export function useRemoveShift() {
  return useFirestoreMutation<string>(
    'shifts',
    (cid, id) => scheduleService.removeShift(cid, id),
    { optimisticDelete: true },
  )
}

export function useCreateTemplate() {
  return useFirestoreMutation<ShiftTemplateFormData, string>('shiftTemplates', (cid, data) =>
    scheduleService.createTemplate(cid, data),
  )
}

export function useRemoveTemplate() {
  return useFirestoreMutation<string>(
    'shiftTemplates',
    (cid, id) => scheduleService.removeTemplate(cid, id),
    { optimisticDelete: true },
  )
}

// ── Novedades aplicadas (instancias en la grilla) ──
export function useNovelties(weekKey: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'novelties', weekKey],
    queryFn: () => scheduleService.getNoveltiesByWeek(companyId!, weekKey),
    enabled: !!companyId && !!weekKey,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, error: error as Error | null, refetch }
}

export function useCreateNovelty() {
  return useFirestoreMutation<NoveltyFormData, string>('novelties', (cid, data) =>
    scheduleService.createNovelty(cid, data),
  )
}

export function useUpdateNovelty() {
  return useFirestoreMutation<{ id: string; data: Partial<NoveltyFormData> }>(
    'novelties',
    (cid, { id, data }) => scheduleService.updateNovelty(cid, id, data),
  )
}

export function useRemoveNovelty() {
  return useFirestoreMutation<string>(
    'novelties',
    (cid, id) => scheduleService.removeNovelty(cid, id),
    { optimisticDelete: true },
  )
}

// ── Tipos de novedad (catálogo, solo lo gestiona el Owner) ──
export function useNoveltyTypes() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'noveltyTypes'],
    queryFn: () => scheduleService.getNoveltyTypes(companyId!),
    enabled: !!companyId,
    staleTime: STALE_MS,
  })

  return { data: data ?? [], loading: isLoading, refetch }
}

export function useCreateNoveltyType() {
  return useFirestoreMutation<NoveltyTypeFormData, string>('noveltyTypes', (cid, data) =>
    scheduleService.createNoveltyType(cid, data),
  )
}

export function useRemoveNoveltyType() {
  return useFirestoreMutation<string>(
    'noveltyTypes',
    (cid, id) => scheduleService.removeNoveltyType(cid, id),
    { optimisticDelete: true },
  )
}
