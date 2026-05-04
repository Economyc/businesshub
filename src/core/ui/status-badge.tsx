import { cn } from '@/lib/utils'

type BadgeVariant = 'active' | 'pending' | 'expired' | 'overdue' | 'inactive' | 'info' | 'paid'
type BadgeSize = 'sm' | 'md'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  active: 'bg-positive-bg text-positive-text',
  paid: 'bg-positive-bg text-positive-text',
  pending: 'bg-warning-bg text-warning-text',
  expired: 'bg-negative-bg text-negative-text',
  overdue: 'bg-negative-bg text-negative-text',
  inactive: 'bg-smoke text-mid-gray',
  info: 'bg-info-bg text-info-text',
}

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-caption',
}

const LABELS: Record<BadgeVariant, string> = {
  active: 'Activo',
  paid: 'Pagado',
  pending: 'Pendiente',
  expired: 'Vencido',
  overdue: 'Vencido',
  inactive: 'Inactivo',
  info: 'En revisión',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label?: string
  size?: BadgeSize
}

export function StatusBadge({ variant, label, size = 'md' }: StatusBadgeProps) {
  return (
    <span className={cn('inline-block rounded-md font-medium', SIZE_STYLES[size], VARIANT_STYLES[variant])}>
      {label ?? LABELS[variant]}
    </span>
  )
}
