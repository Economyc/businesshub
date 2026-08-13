import { useMemo } from 'react'
import { useCompany } from '@/core/hooks/use-company'
import { usePosLocales } from './hooks'
import type { PosLocal } from './types'

interface CompanyLike {
  name?: string | null
  location?: string | null
  posLocalId?: number | null
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

// Matching estricto en 4 niveles de confidence:
//   0) Override `posLocalId`: la company declara su local_id a mano. Gana sobre
//      todo lo demás. Existe porque el heurístico no puede resolver sedes cuyo
//      nombre en el POS no se parece a su `location` (Filipo San Lucas está
//      cargada en el POS como "FILIPO POBLADO").
//   1) Exact: `<name> <location>` == local_descripcion (ej. "Blue Manila")
//   2) Location as word: desc contiene la location como palabra (ej. "BLUE MANILA"
//      contiene "manila")
//   3) Name as unique word: desc contiene el name como palabra Y es el único
//      local que lo cumple (ej. Filipo Belen → "FILIPO" es el único local con
//      "filipo"; el otro es "RANA BRAVA CAFÉ"). Sin este nivel, tenants cuya
//      marca no incluye la location en el nombre del POS quedan sin match.
// Si ninguno resuelve inequívocamente, `useCompanyLocalIds` cae al fallback
// de "todos los locales" — mejor mostrar todo que asignar al local equivocado.
// La excepción es el nivel 0: si hay override, el fallback NO aplica (ver
// useCompanyLocalIds).
export function findMatchingLocal(
  locales: PosLocal[],
  company: CompanyLike | null | undefined,
): PosLocal | null {
  if (!company || locales.length === 0) return null

  // Nivel 0 — override explícito. Una company con override no necesita `name`
  // ni `location`, así que se evalúa antes de esos guards. Si el id no existe
  // en el dominio devolvemos null a propósito: preferimos "sin datos" a caer
  // al heurístico y terminar mostrando las ventas de otra sede.
  if (company.posLocalId != null) {
    return locales.find((l) => Number(l.local_id) === Number(company.posLocalId)) ?? null
  }

  if (!company.location) return null
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
  // Map localId → nombre a mostrar. Para el local que matchea con la company
  // activa, usamos `company.location` (ej. "Belen" en vez de "FILIPO"). Los
  // demás locales mantienen su `local_descripcion` original.
  localDisplayNames: Map<number, string>
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

  const overrideId = selectedCompany?.posLocalId ?? null

  const localIds = useMemo(() => {
    if (matchedLocal) return [Number(matchedLocal.local_id)]
    // Override seteado que no resolvió (id inexistente, o el dominio del tenant
    // cambió): devolver vacío en vez de todos los locales. Mostrar 0 es
    // recuperable; mostrar las ventas de otra sede como propias, no.
    if (overrideId != null && locales.length > 0) return []
    return locales.map((l) => Number(l.local_id))
  }, [matchedLocal, locales, overrideId])

  const aliasName = selectedCompany?.location ?? null
  const matchedId = matchedLocal ? Number(matchedLocal.local_id) : null

  const localDisplayNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const l of locales) {
      const id = Number(l.local_id)
      if (matchedId != null && id === matchedId && aliasName) {
        map.set(id, aliasName)
      } else {
        map.set(id, l.local_descripcion)
      }
    }
    return map
  }, [locales, matchedId, aliasName])

  const localName = matchedLocal ? aliasName ?? matchedLocal.local_descripcion : null
  // El label sigue a `localIds`: con un override que no resolvió no hay locales
  // asignados, así que decir "N locales" mentiría sobre lo que se está mostrando.
  const localLabel =
    localName ?? (localIds.length > 0 ? `${localIds.length} locales` : null)

  return {
    localIds,
    localName,
    localLabel,
    locales,
    matchedLocal,
    localDisplayNames,
    loading,
    error,
  }
}
