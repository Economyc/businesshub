import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon size={40} strokeWidth={1} className="text-smoke mb-4" />
      <h3 className="text-subheading font-medium text-graphite mb-1">{title}</h3>
      <p className="text-body text-mid-gray">{description}</p>
    </div>
  )
}
