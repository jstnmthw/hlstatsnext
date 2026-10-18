import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const linkVariants = cva(
  "cursor-pointer underline-offset-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: "text-primary hover:text-primary-bright hover:underline",
        row: "font-medium text-foreground hover:text-primary-bright hover:underline",
        muted: "text-muted-foreground hover:text-primary-bright hover:underline",
        nav: "inline-flex h-9 items-center gap-1.5 px-2.5 font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-primary-bright data-[active=true]:text-primary-bright [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

interface TextLinkProps extends React.ComponentProps<"a">, VariantProps<typeof linkVariants> {
  /** Render the child (for example a Next.js `Link`) instead of an anchor. */
  asChild?: boolean
}

function TextLink({ className, variant, asChild = false, ...props }: TextLinkProps) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp data-slot="text-link" className={cn(linkVariants({ variant }), className)} {...props} />
  )
}

export { linkVariants, TextLink }
export type { TextLinkProps }
