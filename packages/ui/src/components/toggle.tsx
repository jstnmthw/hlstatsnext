"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive data-[state=on]:bg-secondary data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent hover:bg-accent",
        outline: "border-input data-[state=on]:border-foreground/30",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        default: "h-8 px-2.5 text-sm",
        lg: "h-9 px-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
