import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

// Literal class names so Tailwind's scanner picks them up.
const chartClasses = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"]

interface StackedBarSegment {
  value: number
  className?: string
  color?: string
}

const stackedBarVariants = cva("flex w-full gap-0.5 overflow-hidden", {
  variants: {
    size: {
      default: "h-1.5",
      lg: "h-2.5",
      xl: "h-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

interface StackedBarProps
  extends React.ComponentProps<"div">, VariantProps<typeof stackedBarVariants> {
  segments: StackedBarSegment[]
}

/** Proportional bar. Give it an aria-label that states the figures, or pair it with `StackedBarLegend`. */
function StackedBar({ segments, size, className, ...props }: StackedBarProps) {
  return (
    <div
      role="img"
      data-slot="stacked-bar"
      className={cn(stackedBarVariants({ size }), className)}
      {...props}
    >
      {segments.map((segment, index) => (
        <div
          key={index}
          className={cn(
            "h-full min-w-0",
            segment.className ?? chartClasses[index % chartClasses.length],
          )}
          style={{ flex: segment.value, backgroundColor: segment.color }}
        />
      ))}
    </div>
  )
}

function StackedBarLegend({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="stacked-bar-legend"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

interface StackedBarLegendItemProps extends React.ComponentProps<"div"> {
  swatchClassName?: string
  color?: string
  value?: React.ReactNode
}

function StackedBarLegendItem({
  swatchClassName,
  color,
  value,
  className,
  children,
  ...props
}: StackedBarLegendItemProps) {
  return (
    <div
      data-slot="stacked-bar-legend-item"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      <dt className="inline-flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("size-2.5 shrink-0", swatchClassName ?? "bg-chart-1")}
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{children}</span>
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export { StackedBar, StackedBarLegend, StackedBarLegendItem, stackedBarVariants }
export type { StackedBarProps, StackedBarSegment }
