import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { Progress, type ProgressProps } from "./progress"

/**
 * Rows of label · bar · value · meta. Override the column template with
 * `[--bar-list-columns:110px_minmax(0,1fr)_44px_56px]` on the list.
 */
function BarList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="bar-list"
      className={cn(
        "flex flex-col gap-2.5 [--bar-list-columns:96px_minmax(0,1fr)_48px_48px]",
        className,
      )}
      {...props}
    />
  )
}

interface BarListRowProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode
  /** Bar fill, 0–100. */
  percent: number
  value?: React.ReactNode
  meta?: React.ReactNode
  size?: ProgressProps["size"]
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}

function BarListRow({
  label,
  percent,
  value,
  meta,
  size = "lg",
  indicatorClassName,
  indicatorStyle,
  className,
  ...props
}: BarListRowProps) {
  return (
    <div
      role="listitem"
      data-slot="bar-list-row"
      className={cn("grid grid-cols-(--bar-list-columns) items-center gap-3", className)}
      {...props}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-medium">{label}</span>
      <Progress
        value={percent}
        size={size}
        aria-hidden="true"
        indicatorClassName={indicatorClassName}
        indicatorStyle={indicatorStyle}
      />
      <span className="text-right font-medium tabular-nums">{value}</span>
      <span className="text-right text-muted-foreground tabular-nums">{meta}</span>
    </div>
  )
}

/** Column captions under the rows, aligned to the same template. */
function BarListFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bar-list-footer"
      className={cn(
        "grid grid-cols-(--bar-list-columns) gap-3 border-t pt-2 text-xs text-muted-foreground [&>*:nth-child(n+3)]:text-right",
        className,
      )}
      {...props}
    />
  )
}

export { BarList, BarListFooter, BarListRow }
export type { BarListRowProps }
