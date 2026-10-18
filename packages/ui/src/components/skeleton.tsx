import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-secondary motion-reduce:animate-none", className)}
      {...props}
    />
  )
}

export { Skeleton }
