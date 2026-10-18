import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

function PulseDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pulse-dot"
      aria-hidden="true"
      className={cn(
        "inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-primary-bright motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
}

export { PulseDot }
