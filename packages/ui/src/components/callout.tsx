import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const calloutVariants = cva(
  "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border bg-card/50 px-5 py-4",
  {
    variants: {
      variant: {
        default: "",
        accent: "border-primary-bright/50",
        destructive: "border-destructive/40",
        dashed: "border-dashed border-foreground/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

function Callout({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof calloutVariants>) {
  return (
    <div
      data-slot="callout"
      data-variant={variant ?? "default"}
      className={cn(calloutVariants({ variant }), className)}
      {...props}
    />
  )
}

function CalloutMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-media"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center border text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      {...props}
    />
  )
}

function CalloutContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-content"
      className={cn("flex min-w-0 flex-1 basis-60 flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function CalloutTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="callout-title" className={cn("text-lg font-semibold", className)} {...props} />
  )
}

function CalloutDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="callout-description"
      className={cn(
        "text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary-bright",
        className,
      )}
      {...props}
    />
  )
}

function CalloutActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="callout-actions"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
}

export {
  Callout,
  CalloutActions,
  CalloutContent,
  CalloutDescription,
  CalloutMedia,
  CalloutTitle,
  calloutVariants,
}
