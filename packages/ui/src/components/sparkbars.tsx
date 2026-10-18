import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

interface SparkbarsProps extends React.ComponentProps<"div"> {
  values: number[]
  /** Scale ceiling. Defaults to the largest value. */
  max?: number
  /** Colour the last bar as the live reading. */
  highlightLast?: boolean
  /** Per-bar tooltip text. */
  titles?: (value: number, index: number) => string
  /** Per-bar fill classes; return nothing to keep the default. */
  barClassName?: (value: number, index: number) => string | undefined
}

/** Compact bar series for a trend over time. Describe the series in `aria-label`. */
function Sparkbars({
  values,
  max,
  highlightLast = false,
  titles,
  barClassName,
  className,
  ...props
}: SparkbarsProps) {
  const ceiling = max ?? Math.max(1, ...values)
  const last = values.length - 1

  return (
    <div
      role="img"
      data-slot="sparkbars"
      className={cn("flex h-30 w-full items-end gap-[3px] border-b", className)}
      {...props}
    >
      {values.map((value, index) => (
        <div
          key={index}
          title={titles?.(value, index)}
          className={cn(
            "min-w-0 flex-1 bg-chart-3",
            highlightLast && index === last && "bg-primary-bright",
            barClassName?.(value, index),
          )}
          style={{ height: `${Math.min(100, Math.max(0, (value / ceiling) * 100))}%` }}
        />
      ))}
    </div>
  )
}

/** Axis captions under the bars; children are spread edge to edge. */
function SparkbarsAxis({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sparkbars-axis"
      aria-hidden="true"
      className={cn("flex justify-between text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sparkbars, SparkbarsAxis }
export type { SparkbarsProps }
