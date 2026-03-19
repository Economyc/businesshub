import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-heading font-semibold text-dark-graphite">{title}</h1>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}
