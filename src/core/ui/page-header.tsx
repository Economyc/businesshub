import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  backTo?: string
  children?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, children }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="p-2 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors shrink-0"
            aria-label="Volver"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-heading font-semibold text-dark-graphite truncate">{title}</h1>
          {subtitle && <div className="mt-1">{subtitle}</div>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
