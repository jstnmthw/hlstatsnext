"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const progressVariants = cva("relative w-full overflow-hidden bg-secondary", {
  variants: {
    size: {
      sm: "h-1",
      default: "h-1.5",
      lg: "h-2",
      xl: "h-2.5",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

interface ProgressProps
  extends
    React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}

function Progress({
  className,
  size,
  value,
  max = 100,
  indicatorClassName,
  indicatorStyle,
  ...props
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full bg-primary transition-[width]", indicatorClassName)}
        style={{ width: `${percent}%`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress, progressVariants }
export type { ProgressProps }
