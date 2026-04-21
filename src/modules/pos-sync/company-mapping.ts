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

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

// Matching estricto en 3 niveles de confidence:
//   1) Exact: `<name> <location>` == local_descripcion (ej. "Blue Manila")
//   2) Location as word: desc contiene la location como palabra (ej. "BLUE MANILA"
//      contiene "manila")
//   3) Name as unique word: desc contiene el name como palabra Y es el único
//      local que lo cumple (ej. Filipo Belen → "FILIPO" es el único local con
//      "filipo"; el otro es "RANA BRAVA CAFÉ"). Sin este nivel, tenants cuya
//      marca no incluye la location en el nombre del POS quedan sin match.
// Si ninguno resuelve inequívocamente, `useCompanyLocalIds` cae al fallback
// de "todos los locales" — mejor mostrar todo que asignar al local equivocado.
export function findMatchingLocal(
  locales: PosLocal[],
  company: CompanyLike | null | undefined,
): PosLocal | null {
  if (!company || !company.location || locales.length === 0) return null
  if (!company.name) return null

  const nameNorm = normalize(company.name)
  const locationNorm = normalize(company.location)
  const companyNorm = normalize(`${company.name} ${company.location}`)

  const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm)
  if (exact) return exact

  const locWordRe = new RegExp(`(^|\\s)${escapeRegex(locationNorm)}($|\\s)`)
  const locMatch = locales.find((l) => locWordRe.test(normalize(l.local_descripcion)))
  if (locMatch) return locMatch

  if (nameNorm) {
    const nameWordRe = new RegExp(`(^|\\s)${escapeRegex(nameNorm)}($|\\s)`)
    const nameMatches = locales.filter((l) => nameWordRe.test(normalize(l.local_descripcion)))
    if (nameMatches.length === 1) return nameMatches[0]
  }

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
