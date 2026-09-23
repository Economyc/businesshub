import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { attendanceService, todayBogota } from './services'

export function useFaceProfiles() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'faceProfiles'],
    queryFn: () => attendanceService.getProfiles(companyId!),
    enabled: !!companyId,
  })

  return { data: data ?? [], loading: isLoading, refetch }
}

/** Marcaciones entre dos fechas 'YYYY-MM-DD'. Si el rango incluye hoy se
 *  refresca cada 30 s: las marcaciones llegan desde la tablet. */
export function usePunchesByRange(from: string, to: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const includesToday = to >= todayBogota()

  const { data, isLoading } = useQuery({
    queryKey: ['firestore', companyId, 'attendancePunches', from, to],
    queryFn: () => attendanceService.getPunchesByRange(companyId!, from, to),
    enabled: !!companyId,
    refetchInterval: includesToday ? 30_000 : false,
  })

  return { data: data ?? [], loading: isLoading }
}

export function useScheduledShifts(from: string, to: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data } = useQuery({
    queryKey: ['firestore', companyId, 'shifts', 'range', from, to],
    queryFn: () => attendanceService.getScheduledShifts(companyId!, from, to),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  })

  return data ?? []
}

export function useKioskLink() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['attendanceKioskLink', companyId],
    queryFn: () => attendanceService.kioskLink(companyId!),
    enabled: !!companyId,
    staleTime: Infinity,
  })

  return { token: data ?? null, loading: isLoading, error: error as Error | null, refetch }
}

export function useEnrollFace() {
  return useFirestoreMutation<{ employeeId: string; employeeName: string; descriptor: number[]; thumb: string }>(
    'faceProfiles',
    (cid, { employeeId, ...data }) => attendanceService.enroll(cid, employeeId, data),
  )
}

export function useRemoveFaceProfile() {
  return useFirestoreMutation<string>('faceProfiles', (cid, employeeId) =>
    attendanceService.removeProfile(cid, employeeId),
  )
}
