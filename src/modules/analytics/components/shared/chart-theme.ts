export const CHART_PALETTE = [
  '#5a7a5a',
  '#9a6a6a',
  '#6a7a9a',
  '#9a8a5a',
  '#7a5a8a',
  '#5a9a8a',
  '#8a6a5a',
  '#6a8a5a',
  '#5a6a9a',
  '#9a5a7a',
]

export const CHART_SEMANTIC = {
  income: '#5a7a5a',
  expense: '#9a6a6a',
  purchases: '#6a7a9a',
  payroll: '#9a6a6a',
  operativo: '#5a7a5a',
  obligaciones: '#9a8a5a',
  otros: '#8a8a8a',
  neutral: '#8a8a8a',
  grid: '#eeece9',
  axis: '#8a8a8a',
  muted: '#eeece9',
} as const

export const CHART_AXIS_TICK = { fontSize: 11, fill: CHART_SEMANTIC.axis }

export function paletteColor(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length]
}
