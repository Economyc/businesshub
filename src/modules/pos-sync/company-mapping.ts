import { useMemo } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import { usePosLocales } from './hooks'
import type { PosLocal } from './types'

interface CompanyLike {
  name?: string | null
  location?: string | null
}

function normalize(str: string | null | undefined): string {
  return (str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function findMatchingLocal(
  locales: PosLocal[],
  company: CompanyLike | null | undefined,
): PosLocal | null {
  if (!company || !company.location || locales.length === 0) return null

  const companyNorm = normalize(`${company.name ?? ''} ${company.location}`)
  const locationNorm = normalize(company.location)

  const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm)
  if (exact) return exact

  const partial = locales.find((l) => normalize(l.local_descripcion).includes(companyNorm))
  if (partial) return partial

  const locMatch = locales.find((l) => normalize(l.local_descripcion).includes(locationNorm))
  if (locMatch) return locMatch

  return null
}

export interface UseCompanyLocalIdsResult {
  localIds: number[]
  localName: string | null
  localLabel: string | null
  locales: PosLocal[]
  matchedLocal: PosLocal | null
  loading: boolean
  error: string | null
}

export function useCompanyLocalIds(): UseCompanyLocalIdsResult {
  const { locales, loading, error } = usePosLocales()
  const { selectedCompany } = useCompany()

  const matchedLocal = useMemo(
    () => findMatchingLocal(locales, selectedCompany),
    [locales, selectedCompany],
  )

  const localIds = useMemo(() => {
    if (matchedLocal) return [Number(matchedLocal.local_id)]
    return locales.map((l) => Number(l.local_id))
  }, [matchedLocal, locales])

  const localName = matchedLocal?.local_descripcion ?? null
  const localLabel = localName ?? (locales.length > 0 ? `${locales.length} locales` : null)

  return {
    localIds,
    localName,
    localLabel,
    locales,
    matchedLocal,
    loading,
    error,
  }
}
