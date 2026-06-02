import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/core/ui/empty-state'

interface PlaceholderTabProps {
  icon: LucideIcon
  label: string
}

// Pestañas montadas pero aún no implementadas (Fase 1 solo entrega Insumos).
export function PlaceholderTab({ icon, label }: PlaceholderTabProps) {
  return (
    <EmptyState
      icon={icon}
      title={`${label} — próximamente`}
      description="Esta sección llega en una próxima fase del módulo de Inventarios."
    />
  )
}
