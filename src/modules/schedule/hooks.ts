import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { scheduleService } from './services'
import type { ShiftFormData, ShiftTemplateFormData } from './types'

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
