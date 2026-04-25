import { useContext } from 'react'
import { SettingsContext } from '@/core/ui/company-provider'

// Hook para categorias, roles y departamentos. Subscribe solo al
// SettingsContext: cambios en settings no re-renderean a quien usa
// useCompany() (companies + selectedCompany), y viceversa.
export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within CompanyProvider')
  }
  return context
}
