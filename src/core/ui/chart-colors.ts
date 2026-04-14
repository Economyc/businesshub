/**
 * Tokens de color para charts. Siempre usar estas referencias en lugar de hex hardcodeado.
 * Las CSS vars se resuelven en runtime y reaccionan a dark mode automáticamente.
 * Ver DESIGN_SYSTEM.md §7.
 */

export const chartColors = {
  positive: "var(--app-positive-text)",
  positiveBg: "var(--app-positive-bg)",
  negative: "var(--app-negative-text)",
  negativeBg: "var(--app-negative-bg)",
  warning: "var(--app-warning-text)",
  warningBg: "var(--app-warning-bg)",
  info: "var(--app-info-text)",
  infoBg: "var(--app-info-bg)",
  neutral: "var(--app-mid-gray)",
  muted: "var(--app-border)",
  grid: "var(--app-border)",
  text: "var(--app-mid-gray)",
  surface: "var(--app-surface)",
  foreground: "var(--app-graphite)",
} as const

/**
 * Para librerías que no aceptan CSS vars (ej. Chart.js con fills), resuelve a hex/color computado.
 * Usar sólo cuando la librería lo requiera; preferir `chartColors` directo.
 */
export function resolveChartColor(token: keyof typeof chartColors): string {
  if (typeof window === "undefined") return ""
  const varName = chartColors[token].replace("var(", "").replace(")", "")
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

export type ChartColorToken = keyof typeof chartColors
