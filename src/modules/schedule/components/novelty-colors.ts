import type { NoveltyColor } from '../types'

// Paleta fija de colores para tipos de novedad. Cada color mapea a un par de
// tokens del Design System (bg + text + border) — nunca hex hardcodeado. Las
// clases se escriben como strings literales completos para que Tailwind las
// extraiga en build (no concatenar dinámicamente o se purgan).
//   - chip:   clases del chip en la grilla (borde + fondo + texto)
//   - swatch: color sólido para el selector de color y la lista de tipos
export const NOVELTY_COLORS: Record<NoveltyColor, { label: string; chip: string; swatch: string }> = {
  green: { label: 'Verde', chip: 'border-positive-text/15 bg-positive-bg text-positive-text', swatch: 'bg-positive-text' },
  amber: { label: 'Ámbar', chip: 'border-warning-text/15 bg-warning-bg text-warning-text', swatch: 'bg-warning-text' },
  red: { label: 'Rojo', chip: 'border-negative-text/15 bg-negative-bg text-negative-text', swatch: 'bg-negative-text' },
  blue: { label: 'Azul', chip: 'border-info-text/15 bg-info-bg text-info-text', swatch: 'bg-info-text' },
  gray: { label: 'Gris', chip: 'border-border/60 bg-smoke text-mid-gray', swatch: 'bg-mid-gray' },
}

export const NOVELTY_COLOR_KEYS = Object.keys(NOVELTY_COLORS) as NoveltyColor[]

export const DEFAULT_NOVELTY_COLOR: NoveltyColor = 'blue'
