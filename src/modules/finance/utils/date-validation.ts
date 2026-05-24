// Validación de fechas sospechosas. El lector IA de facturas a veces se equivoca
// de año (pone 2024/2025), así que avisamos cuando la fecha de un documento o
// pago es de hace más de 3 meses. Es solo una advertencia (no bloqueo duro): el
// usuario puede confirmar y continuar si la fecha vieja es legítima.

export const STALE_DATE_MONTHS = 3

// true si la fecha ISO (YYYY-MM-DD) es de hace más de 3 meses respecto a hoy.
// Comparación a nivel día (sin horas) para evitar líos de zona horaria. Las
// fechas futuras NO se consideran viejas (devuelve false).
export function isDateTooOld(iso: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  // Umbral = hoy menos 3 meses. Fijamos el día con clamp al último día del mes
  // objetivo para evitar el desborde de JS (ej. 31 may − 3 meses → "31 feb" →
  // 3 mar, que acortaría la ventana). JS maneja mes negativo retrocediendo el año.
  const ty = now.getFullYear()
  const tm = now.getMonth() - STALE_DATE_MONTHS
  const lastDay = new Date(ty, tm + 1, 0).getDate()
  const threshold = new Date(ty, tm, Math.min(now.getDate(), lastDay))
  return date < threshold
}

// Formatea una fecha ISO (YYYY-MM-DD) a texto legible para el aviso.
export function formatStaleDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
