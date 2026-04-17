import { createContext, useContext, useState, type ReactNode } from 'react'

interface HomeFiltersContextValue {
  selectedCaja: string
  setSelectedCaja: (caja: string) => void
}

const HomeFiltersContext = createContext<HomeFiltersContextValue | null>(null)

export function HomeFiltersProvider({ children }: { children: ReactNode }) {
  const [selectedCaja, setSelectedCaja] = useState<string>('todas')

  return (
    <HomeFiltersContext.Provider value={{ selectedCaja, setSelectedCaja }}>
      {children}
    </HomeFiltersContext.Provider>
  )
}

export function useHomeFilters(): HomeFiltersContextValue {
  const ctx = useContext(HomeFiltersContext)
  if (!ctx) throw new Error('useHomeFilters must be used within HomeFiltersProvider')
  return ctx
}
