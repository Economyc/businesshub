// Port server-side de src/modules/pos-sync/company-mapping.ts.
// Mantener las reglas idénticas para que el cron hidrate cache usando el
// mismo mapeo company↔local que luego ve el cliente.

import { db } from './firestore.js'
import type { PosLocalRaw } from './pos-client.js'

interface CompanyLike {
  name?: string | null
  location?: string | null
}

export function normalize(str: string | null | undefined): string {
  return (str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function findMatchingLocal(
  locales: PosLocalRaw[],
  company: CompanyLike | null | undefined,
): PosLocalRaw | null {
  if (!company || !company.location || locales.length === 0) return null

  const companyNorm = normalize(`${company.name ?? ''} ${company.location}`)
  const locationNorm = normalize(company.location)

  const exact = locales.find((l) => normalize(l.local_descripcion) === companyNorm)
  if (exact) return exact

  const locWord = new RegExp(
    `(^|\\s)${locationNorm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|\\s)`,
  )
  const locMatch = locales.find((l) => locWord.test(normalize(l.local_descripcion)))
  if (locMatch) return locMatch

  return null
}

export interface CompanyLocalMapEntry {
  companyId: string
  localIds: number[]
  matchedExact: boolean
}

// Itera todas las companies en Firestore y resuelve qué localIds le tocan.
// Companies sin match explícito se omiten: el cliente sigue manejándolas
// on-demand usando el fallback "todos los locales" de `useCompanyLocalIds`.
export async function buildCompanyLocalMap(
  locales: PosLocalRaw[],
): Promise<CompanyLocalMapEntry[]> {
  const snap = await db.collection('companies').get()
  const entries: CompanyLocalMapEntry[] = []
  for (const doc of snap.docs) {
    const company = doc.data() as CompanyLike
    const matched = findMatchingLocal(locales, company)
    if (!matched) continue
    entries.push({
      companyId: doc.id,
      localIds: [Number(matched.local_id)],
      matchedExact: true,
    })
  }
  return entries
}
