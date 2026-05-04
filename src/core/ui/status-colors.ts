export type StatusTone = 'positive' | 'warning' | 'negative' | 'info' | 'neutral'

export const statusPill: Record<StatusTone, string> = {
  positive: 'bg-positive-bg text-positive-text',
  warning: 'bg-warning-bg text-warning-text',
  negative: 'bg-negative-bg text-negative-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-bone text-graphite',
}

export const statusText: Record<StatusTone, string> = {
  positive: 'text-positive-text',
  warning: 'text-warning-text',
  negative: 'text-negative-text',
  info: 'text-info-text',
  neutral: 'text-mid-gray',
}

export const statusBorder: Record<StatusTone, string> = {
  positive: 'border-positive-text',
  warning: 'border-warning-text',
  negative: 'border-negative-text',
  info: 'border-info-text',
  neutral: 'border-border',
}
