import { IconCheck } from "@tabler/icons-react"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

function Steps({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="steps"
      className={cn("grid auto-cols-fr grid-flow-col gap-2 [counter-reset:step]", className)}
      {...props}
    />
  )
}

type StepStatus = "complete" | "current" | "upcoming"

const stepClasses: Record<StepStatus, string> = {
  complete:
    "text-primary [&>[data-slot=step-bar]]:bg-primary [&>[data-slot=step-label]>[data-slot=step-marker]]:border-primary",
  current:
    "text-primary-bright [&>[data-slot=step-bar]]:bg-primary-bright [&>[data-slot=step-label]>[data-slot=step-marker]]:border-primary-bright",
  upcoming:
    "text-muted-foreground [&>[data-slot=step-bar]]:bg-secondary [&>[data-slot=step-label]>[data-slot=step-marker]]:border-muted-foreground",
}

interface StepProps extends React.ComponentProps<"li"> {
  status?: StepStatus
}

function Step({ status = "upcoming", className, children, ...props }: StepProps) {
  return (
    <li
      data-slot="step"
      data-status={status}
      aria-current={status === "current" ? "step" : undefined}
      className={cn("flex flex-col gap-2 [counter-increment:step]", stepClasses[status], className)}
      {...props}
    >
      <div data-slot="step-bar" className="h-1 w-full" />
      <span data-slot="step-label" className="inline-flex items-center gap-2 font-medium">
        <span
          data-slot="step-marker"
          className="inline-flex size-5 shrink-0 items-center justify-center border text-xs font-bold before:content-[counter(step)] data-[complete]:before:content-none"
          data-complete={status === "complete" ? "" : undefined}
        >
          {status === "complete" && <IconCheck className="size-3" aria-label="Done" />}
        </span>
        {children}
      </span>
    </li>
  )
}

export { Step, Steps }
export type { StepProps, StepStatus }
