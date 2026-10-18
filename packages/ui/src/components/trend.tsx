import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

type TrendDirection = "up" | "down" | "flat"

const directionClasses: Record<TrendDirection, string> = {
  up: "text-primary-bright",
  down: "text-destructive",
  flat: "text-muted-foreground",
}

const arrows: Record<TrendDirection, string> = { up: "▲", down: "▼", flat: "—" }

interface TrendProps extends React.ComponentProps<"span"> {
  /** Signed change. Its sign picks the direction and its magnitude is shown when there are no children. */
  value?: number
  /** Overrides the direction derived from `value`. */
  direction?: TrendDirection
  showArrow?: boolean
  format?: (magnitude: number) => React.ReactNode
}

function Trend({
  value,
  direction,
  showArrow = true,
  format = (n) => n.toLocaleString(),
  className,
  children,
  ...props
}: TrendProps) {
  const dir: TrendDirection =
    direction ?? (value === undefined || value === 0 ? "flat" : value > 0 ? "up" : "down")
  const content =
    children ?? (value === undefined || dir === "flat" ? null : format(Math.abs(value)))

  return (
    <span
      data-slot="trend"
      data-direction={dir}
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        directionClasses[dir],
        className,
      )}
      {...props}
    >
      {showArrow && (dir !== "flat" || content === null) && (
        <span aria-hidden="true">{arrows[dir]}</span>
      )}
      {dir !== "flat" && <span className="sr-only">{dir}</span>}
      {content}
    </span>
  )
}

export { Trend }
export type { TrendDirection, TrendProps }
