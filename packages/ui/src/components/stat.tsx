import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"
import { Trend, type TrendProps } from "./trend"

const statGroupVariants = cva("", {
  variants: {
    variant: {
      grid: "grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3",
      strip:
        "flex divide-x overflow-x-auto rounded-xl border bg-card [&>[data-slot=stat]]:min-w-0 [&>[data-slot=stat]]:flex-1 [&>[data-slot=stat]]:px-3.5 [&>[data-slot=stat]]:py-3",
      inline: "flex flex-wrap items-center gap-x-5 gap-y-2",
    },
  },
  defaultVariants: {
    variant: "grid",
  },
})

function StatGroup({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statGroupVariants>) {
  return (
    <div
      data-slot="stat-group"
      data-variant={variant ?? "grid"}
      className={cn(statGroupVariants({ variant }), className)}
      {...props}
    />
  )
}

const statVariants = cva("flex min-w-0 flex-col gap-0.5", {
  variants: {
    variant: {
      plain: "",
      tile: "rounded-xl border bg-card px-5 py-4",
      inline: "flex-row items-baseline gap-1.5 whitespace-nowrap",
    },
  },
  defaultVariants: {
    variant: "plain",
  },
})

function Stat({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof statVariants>) {
  return (
    <div
      data-slot="stat"
      data-variant={variant ?? "plain"}
      className={cn(statVariants({ variant }), className)}
      {...props}
    />
  )
}

function StatLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stat-label"
      className={cn("truncate text-xs font-medium text-muted-foreground uppercase", className)}
      {...props}
    />
  )
}

const statValueVariants = cva("inline-flex items-center gap-2 font-bold tabular-nums", {
  variants: {
    size: {
      xs: "text-base",
      sm: "text-2xl",
      default: "text-3xl",
      lg: "text-5xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

function StatValue({
  className,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statValueVariants>) {
  return (
    <span
      data-slot="stat-value"
      className={cn(statValueVariants({ size }), className)}
      {...props}
    />
  )
}

/** Secondary part of a value, such as the total in "39 / 140". */
function StatUnit({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stat-unit"
      className={cn("text-lg font-normal text-muted-foreground", className)}
      {...props}
    />
  )
}

function StatChange({ className, showArrow = false, ...props }: TrendProps) {
  return (
    <Trend
      data-slot="stat-change"
      showArrow={showArrow}
      className={cn("truncate text-xs font-normal", className)}
      {...props}
    />
  )
}

export { Stat, StatChange, StatGroup, statGroupVariants, StatLabel, StatUnit, StatValue }
