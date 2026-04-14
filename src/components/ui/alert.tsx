import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-body grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 [&>svg]:size-4 [&>svg]:mt-0.5",
  {
    variants: {
      variant: {
        default: "bg-card-bg text-graphite border-border/60",
        positive:
          "bg-positive-bg text-positive-text border-transparent [&>svg]:text-positive-text",
        warning:
          "bg-warning-bg text-warning-text border-transparent [&>svg]:text-warning-text",
        negative:
          "bg-negative-bg text-negative-text border-transparent [&>svg]:text-negative-text",
        info:
          "bg-info-bg text-info-text border-transparent [&>svg]:text-info-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 text-subheading font-medium leading-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-caption opacity-90", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
