// Sedes que además de Rappi liquidan domicilios por DiDi. Va fijo acá porque es
// un dato comercial (qué local tiene contrato con la plataforma), no algo que el
// usuario configure desde la app.
//
// Los docId están repetidos a propósito: el registro de sedes de
// `src/core/pnl/companies.ts` todavía no está en el repo, y el build de
// producción compila desde GitHub. Cuando ese archivo se commitee, esta lista
// puede pasar a resolverse con `companyById(...).key`.
const DIDI_COMPANY_IDS = new Set([
  '3mU7Tld2uq1OjTLrgbQ2', // Blue Escondite
  'C06xQypKRqtVenO4ZLfy', // Filipo Belén
  'L3yMbGCeVgL3pQvA1hi4', // Filipo San Lucas
])

export function companyHasDidi(companyId?: string): boolean {
  return !!companyId && DIDI_COMPANY_IDS.has(companyId)
}
