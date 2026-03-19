import { cn } from '@/lib/utils'

type BadgeVariant = 'active' | 'pending' | 'expired' | 'overdue' | 'inactive' | 'info' | 'paid'

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  active: 'bg-positive-bg text-positive-text',
  paid: 'bg-positive-bg text-positive-text',
  pending: 'bg-warning-bg text-warning-text',
  expired: 'bg-negative-bg text-negative-text',
  overdue: 'bg-negative-bg text-negative-text',
  inactive: 'bg-smoke text-mid-gray',
  info: 'bg-info-bg text-info-text',
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
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span className={cn('inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium', VARIANT_STYLES[variant])}>
      {label ?? LABELS[variant]}
    </span>
  )
}
