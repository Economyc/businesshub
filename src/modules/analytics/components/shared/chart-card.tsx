import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { staggerItem } from '@/core/animations/variants'

interface ChartCardProps {
  title: string
  eyebrow?: string
  action?: ReactNode
  description?: string
  children: ReactNode
  className?: string
  padded?: boolean
}

export function ChartCard({
  title,
  eyebrow,
  action,
  description,
  children,
  className = '',
  padded = true,
}: ChartCardProps) {
  return (
    <motion.section
      variants={staggerItem}
      className={`bg-surface rounded-2xl card-elevated ${padded ? 'p-6' : 'p-4'} ${className}`}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-1">
              {eyebrow}
            </p>
          )}
          <h2 className="text-subheading font-semibold text-dark-graphite leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-caption text-mid-gray mt-1">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </motion.section>
  )
}
