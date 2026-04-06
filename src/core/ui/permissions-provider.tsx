import type { ReactNode } from 'react'
import { PermissionsContext, usePermissionsLoader } from '@/core/hooks/use-permissions'

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const value = usePermissionsLoader()

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}
