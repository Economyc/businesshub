import { chartColors } from '@/core/ui/chart-colors'

// Paleta para series con identidad semántica.
// Todos los valores son CSS vars → reaccionan a dark mode automáticamente.
// Ver DESIGN_SYSTEM.md §7.
export const CHART_PALETTE: string[] = [
  chartColors.positive,
  chartColors.negative,
  chartColors.info,
  chartColors.warning,
  chartColors.neutral,
  chartColors.positiveBg,
  chartColors.negativeBg,
  chartColors.infoBg,
  chartColors.warningBg,
  chartColors.muted,
]

export const CHART_SEMANTIC = {
  income: chartColors.positive,
  expense: chartColors.negative,
  purchases: chartColors.info,
  payroll: chartColors.negative,
  operativo: chartColors.positive,
  obligaciones: chartColors.warning,
  otros: chartColors.neutral,
  neutral: chartColors.neutral,
  grid: chartColors.grid,
  axis: chartColors.text,
  muted: chartColors.muted,
} as const

export const CHART_AXIS_TICK = { fontSize: 11, fill: CHART_SEMANTIC.axis }

export function paletteColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length]
}
