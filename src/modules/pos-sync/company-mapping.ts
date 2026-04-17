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

// Matching estricto: aceptamos match exacto (nombre completo o location como
// sustring significativa del nombre del local), pero rechazamos coincidencias
// parciales que puedan mezclar locales con nombres compartidos. Si no hay
// match limpio devolvemos null y `useCompanyLocalIds` recurre a todos los
// locales — mejor mostrar todo junto que asignar al local equivocado.
export function findMatchingLocal(
  locales: PosLocal[],
  company: CompanyLike | null | undefined,
): PosLocal | null {
  if (!company || !company.location || locales.length === 0) return null

  const companyNorm = normalize(`${company.name ?? ''} ${company.location}`)
  const locationNorm = normalize(company.location)

  const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm)
  if (exact) return exact

  // Match estricto por location: el nombre del local debe contener la location
  // como palabra completa (delimitada por borde o espacio), no sustring.
  const locWord = new RegExp(`(^|\\s)${locationNorm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|\\s)`)
  const locMatch = locales.find((l) => locWord.test(normalize(l.local_descripcion)))
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
