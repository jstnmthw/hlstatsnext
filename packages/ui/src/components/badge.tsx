import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"
import { type ColorScheme, type StyleVariant, getComponentStyles } from "../lib/color-variants"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Markers for the getBadgeStyles logic
        solid: "",
        outline: "",
        ghost: "",
      },
    },
    defaultVariants: {
      variant: "solid",
    },
  },
)

// Helper function for badge-specific styling
const getBadgeStyles = (
  variant: StyleVariant,
  colorScheme: ColorScheme,
  asChild: boolean = false,
): string[] => {
  return getComponentStyles(colorScheme, variant, {
    componentType: "badge",
    includeIcon: true,
    includeHover: asChild,
    includeActive: asChild,
  })
}

// Define the props type using the new variants
interface BadgeProps
  extends Omit<React.ComponentProps<"span">, "color">, // Omit HTML 'color' prop
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  colorScheme?: ColorScheme // Add colorScheme prop
}

function Badge({
  className,
  variant = "solid",
  colorScheme = "dark/white",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  // Get the specific variant+colorScheme styles using the helper
  const dynamicStyles = getBadgeStyles(variant!, colorScheme, asChild)

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant, className }), // Base cva styles
        dynamicStyles, // Variant + ColorScheme specific styles
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps, StyleVariant as BadgeVariant, ColorScheme } // Export relevant types
