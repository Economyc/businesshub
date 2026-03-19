import { createContext, useState, useCallback, type ReactNode } from 'react'
import type { Company } from '@/core/types'

interface CompanyContextValue {
  companies: Company[]
  selectedCompany: Company | null
  selectCompany: (company: Company) => void
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

const DEFAULT_COMPANIES: Company[] = [
  { id: 'company-a', name: 'Compañía A', slug: 'company-a', createdAt: null as any },
  { id: 'company-b', name: 'Compañía B', slug: 'company-b', createdAt: null as any },
  { id: 'company-c', name: 'Compañía C', slug: 'company-c', createdAt: null as any },
  { id: 'company-d', name: 'Compañía D', slug: 'company-d', createdAt: null as any },
]

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies] = useState<Company[]>(DEFAULT_COMPANIES)
  const [selectedCompany, setSelectedCompany] = useState<Company>(DEFAULT_COMPANIES[0])

  const selectCompany = useCallback((company: Company) => {
    setSelectedCompany(company)
  }, [])

  return (
    <CompanyContext.Provider value={{ companies, selectedCompany, selectCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}
