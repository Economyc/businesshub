// Helpers de texto y fechas del motor de P&L.
//
// Contrato de `src/core/pnl/` (lo consumen Node y el navegador sin tooling):
//   - imports relativos de VALOR siempre con extension explicita `.ts`
//   - `@/` solo en `import type`
//   - sintaxis borrable: nada de enum/namespace/parameter properties
//   - sin firebase/*, sin DOM, sin process
// Hay un test que lo verifica: src/core/pnl/contract.test.ts

/** Minusculas sin tildes ni espacios sobrantes. */
export const normalize = (s: unknown): string =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Categoria completa normalizada, conservando la subcategoria ("servicios > contabilidad"). */
export const fullCat = (c: unknown): string => normalize(c).replace(/\s*>\s*/g, ' > ')

/** Categoria madre ("Suministros > Pan" → "suministros"). */
export const parentCat = (c: unknown): string => fullCat(c).split(' > ')[0].trim()

/**
 * Acepta Timestamp del admin SDK, del SDK web, o un Date. Es duck typing a
 * proposito: ambos Timestamp exponen `.toDate()`, y asi este archivo no importa
 * firebase ni en Node ni en el navegador.
 */
export const toDate = (ts: unknown): Date | null => {
  if (ts instanceof Date) return ts
  const maybe = ts as { toDate?: () => Date } | null | undefined
  return typeof maybe?.toDate === 'function' ? maybe.toDate() : null
}

/** Numero seguro: `undefined`, `null` y `NaN` valen 0. */
export const num = (v: unknown): number => Number(v) || 0
