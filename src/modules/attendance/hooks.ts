import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { useFirestoreMutation } from '@/core/query/use-mutation'
import { attendanceService, todayBogota } from './services'
import type { AttendanceConfig, AttendancePunch } from './types'

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

// Correcciones: invalidan `attendancePunches`, que por prefijo cubre todos los rangos.
export function useAddManualPunch() {
  return useFirestoreMutation<Parameters<typeof attendanceService.addManualPunch>[1]>(
    'attendancePunches',
    (cid, data) => attendanceService.addManualPunch(cid, data),
  )
}

export function useEditPunchTime() {
  return useFirestoreMutation<{ punch: AttendancePunch; at: Date; reason: string; by: string }>(
    'attendancePunches',
    (cid, { punch, at, reason, by }) => attendanceService.editPunchTime(cid, punch, at, reason, by),
  )
}

export function useVoidPunch() {
  return useFirestoreMutation<{ punchId: string; reason: string; by: string }>(
    'attendancePunches',
    (cid, { punchId, reason, by }) => attendanceService.voidPunch(cid, punchId, reason, by),
  )
}

export function useApproveExtra() {
  return useFirestoreMutation<{ inPunchId: string; by: string; approve: boolean }>(
    'attendancePunches',
    (cid, { inPunchId, by, approve }) =>
      approve ? attendanceService.approveExtra(cid, inPunchId, by) : attendanceService.revokeExtra(cid, inPunchId),
  )
}

export function useAttendanceConfig() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const { data, isLoading } = useQuery({
    queryKey: ['firestore', companyId, 'attendanceConfig'],
    queryFn: () => attendanceService.getConfig(companyId!),
    enabled: !!companyId,
  })
  return { config: data ?? { scheduleOnlyEmployeeIds: [] }, loading: isLoading }
}

export function useSaveAttendanceConfig() {
  return useFirestoreMutation<AttendanceConfig>('attendanceConfig', (cid, config) => attendanceService.saveConfig(cid, config))
}
