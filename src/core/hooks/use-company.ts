import { useContext } from 'react'
import { CompanyContext } from '@/core/ui/company-provider'

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider')
  }
  return context
}
