import { useCallback, useEffect, useState } from 'react'
import { useCompany } from './use-company'
import { fetchBranches } from '@/core/services/branches-service'
import type { Branch } from '@/core/types/branch'

export interface UseBranchesResult {
  branches: Branch[]
  activeBranches: Branch[]
  loading: boolean
  refetch: () => Promise<void>
}

export function useBranches(): UseBranchesResult {
  const { selectedCompany } = useCompany()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!selectedCompany) {
      setBranches([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchBranches(selectedCompany.id)
      data.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      setBranches(data)
    } catch (err) {
      console.error('Error loading branches:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany])

  useEffect(() => {
    load()
  }, [load])

  return {
    branches,
    activeBranches: branches.filter((b) => b.isActive),
    loading,
    refetch: load,
  }
}
