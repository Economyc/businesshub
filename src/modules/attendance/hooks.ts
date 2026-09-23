import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { attendanceService } from './services'

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

export function usePunchesByDate(date: string) {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['firestore', companyId, 'attendancePunches', date],
    queryFn: () => attendanceService.getPunchesByDate(companyId!, date),
    enabled: !!companyId,
    // Las marcaciones llegan desde la tablet: refrescar solo mientras se mira.
    refetchInterval: 30_000,
  })

  const sorted = (data ?? []).slice().sort((a, b) => b.at.toMillis() - a.at.toMillis())
  return { data: sorted, loading: isLoading, refetch }
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
