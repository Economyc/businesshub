import type { ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface RichHoverMetric {
  label: string
  value: string
  accent?: boolean
}

interface RichHoverTooltipProps {
  title: string
  accentColor?: string
  metrics: RichHoverMetric[]
  footer?: string
  children: ReactNode
  side?: 'top' | 'right' | 'left' | 'bottom'
}

export function RichHoverTooltip({
  title,
  accentColor,
  metrics,
  footer,
  children,
  side = 'top',
}: RichHoverTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        collisionPadding={12}
        className="bg-surface text-graphite card-elevated border border-border/60 rounded-xl px-4 py-3 min-w-[220px] shadow-none"
      >
        <div className="flex items-center gap-2">
          {accentColor && (
            <span
              aria-hidden
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
          )}
          <span className="text-body font-medium text-dark-graphite truncate">
            {title}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <p className="text-caption uppercase tracking-wider text-mid-gray font-medium">
                {m.label}
              </p>
              <p
                className={`${
                  m.accent ? 'text-subheading' : 'text-body'
                } font-semibold text-dark-graphite tabular-nums truncate`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {footer && (
          <p className="text-caption text-mid-gray pt-2 border-t border-border/60 mt-3">
            {footer}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
