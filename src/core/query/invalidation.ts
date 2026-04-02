import { queryClient } from './query-client'

export function invalidateCollection(companyId: string, collectionName: string) {
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId, collectionName] })
}

export function invalidateCompanyData(companyId: string) {
  queryClient.invalidateQueries({ queryKey: ['firestore', companyId] })
}
