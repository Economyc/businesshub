import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap border",
  {
    variants: {
      variant: {
        default:
          "bg-smoke text-graphite border-transparent",
        positive:
          "bg-positive-bg text-positive-text border-transparent",
        warning:
          "bg-warning-bg text-warning-text border-transparent",
        negative:
          "bg-negative-bg text-negative-text border-transparent",
        info:
          "bg-info-bg text-info-text border-transparent",
        outline:
          "bg-transparent text-graphite border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
