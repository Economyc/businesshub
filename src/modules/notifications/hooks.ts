import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/core/hooks/use-company'
import { notificationService } from './services'

export function useNotifications() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id

  return useQuery({
    queryKey: ['firestore', companyId, 'notifications'],
    queryFn: () => notificationService.getAll(companyId!),
    enabled: !!companyId,
    refetchInterval: 60_000, // Poll every minute for new notifications
  })
}

export function useUnreadCount() {
  const { data: notifications } = useNotifications()
  return notifications?.filter((n) => !n.read).length ?? 0
}

export function useMarkAsRead() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(companyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const { selectedCompany } = useCompany()
  const companyId = selectedCompany?.id
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firestore', companyId, 'notifications'] })
    },
  })
}
