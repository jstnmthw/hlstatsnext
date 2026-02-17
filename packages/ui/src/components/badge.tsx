import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { getComponentStyles, type ColorScheme, type StyleVariant } from "../lib/color-variants"
import { cn } from "../lib/utils"

// Use types from shared color variants system
type Variant = StyleVariant | "primary" | "secondary" | "destructive"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[4px] border px-1.5 py-0.15 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        // Original variants (use colorScheme system)
        solid: "",
        outline: "",
        ghost: "",
        // Semantic variants (use CSS theme variables directly)
        primary: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-input bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
      },
    },
    defaultVariants: {
      variant: "primary",
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
  extends
    Omit<React.ComponentProps<"span">, "color">, // Omit HTML 'color' prop
    VariantProps<typeof badgeVariants> {
  asChild?: boolean
  colorScheme?: ColorScheme // Add colorScheme prop
}

function Badge({
  className,
  variant = "primary",
  colorScheme = "dark/white",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  // Semantic variants use CSS theme variables directly; original variants use colorScheme system
  const isSemanticVariant =
    variant === "primary" || variant === "secondary" || variant === "destructive"
  const dynamicStyles = isSemanticVariant
    ? []
    : getBadgeStyles(variant as StyleVariant, colorScheme, asChild)

  return (
    <Comp
      data-slot="badge"
      className={cn(
        badgeVariants({ variant }), // Base cva styles
        dynamicStyles, // Variant + ColorScheme specific styles
        className, // Custom classes last for proper override precedence
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
export type { BadgeProps, Variant as BadgeVariant, ColorScheme } // Export relevant types
