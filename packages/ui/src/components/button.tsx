import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { getComponentStyles, type ColorScheme, type StyleVariant } from "../lib/color-variants"
import { cn } from "../lib/utils"

// Base styles that apply to all button variants
const baseButtonStyles = [
  // Base (removed 'border' - let variants control it explicitly)
  "relative cursor-pointer isolate inline-flex items-baseline items-center justify-center gap-x-2 rounded-md text-base font-semibold",

  // Reduce gap when there's both icon and text
  "has-[>svg+*]:gap-x-1.5",

  // Focus
  "focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500",

  // Disabled
  "disabled:opacity-50 disabled:pointer-events-none",

  // Icon Base Styling (Sizing/Margins handled in size variants)
  "[&>svg]:shrink-0 [&>svg]:self-center",

  // Icon colors handled per variant/scheme below
  "forced-colors:[&>svg]:text-[ButtonText]",
]

// Solid button base styles - Explicit border control
const solidBaseStyles = [
  "border border-transparent", // Explicit border for solid (transparent by default)

  // Structural before/after for solid buttons (backgrounds applied in colorVariants)
  "before:absolute before:inset-0 before:-z-10 before:rounded-[calc(theme(borderRadius.md)-1px)]",
  "before:shadow-sm", // Shadow for solid buttons
  "dark:before:hidden", // Hides the light-mode shadow in dark mode
  "dark:border-white/5", // Add subtle border in dark mode for solid
  "after:absolute after:inset-0 after:-z-10 after:rounded-[calc(theme(borderRadius.md)-1px)]",
  "after:shadow-[inset_0_1px_theme(colors.white/15%)]", // Inner highlight
  "dark:after:-inset-px", // Dark mode adjustment for highlight
  "disabled:before:shadow-none disabled:after:shadow-none", // Disabled state
]

// Outline button base styles - Explicit border for visibility
const outlineBaseStyles: string[] = [
  "border", // Outline needs visible border (color set by color variants)
]

// Ghost button base styles - Explicit transparent border
const ghostBaseStyles = [
  "border-transparent", // No visible border for ghost (no !important needed)
]

// Use types from shared color variants system
type Variant = StyleVariant | "primary" | "secondary" | "destructive"

// cva for base styles and sizing (Remove icon color styles)
const buttonVariants = cva(baseButtonStyles, {
  variants: {
    variant: {
      // Original variants (use colorScheme system)
      solid: "",
      outline: "",
      ghost: "",
      // Semantic variants (use CSS theme variables directly)
      primary:
        "border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
      secondary:
        "border border-input bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 active:bg-secondary/70",
      destructive:
        "border border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/80",
    },
    size: {
      // Regular sizes with automatic icon-only detection - now using 2px increment font scale
      xs: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-1px)] text-xs has-[>svg+*]:pl-[calc(theme(spacing.2)-1px)] has-[>svg+*]:pr-[calc(theme(spacing.3)-1px)] has-[>svg:only-child]:px-[calc(theme(spacing.1)-1px)] has-[>svg:only-child]:py-[calc(theme(spacing.1)-1px)] [&>svg]:size-4",
      sm: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-1px)] text-sm has-[>svg+*]:pl-[calc(theme(spacing.2)-1px)] has-[>svg+*]:pr-[calc(theme(spacing.3)-1px)] has-[>svg:only-child]:px-[calc(theme(spacing.2)-1.5px)] has-[>svg:only-child]:py-[calc(theme(spacing.2)-1.5px)] [&>svg]:size-4",
      default:
        "px-[calc(theme(spacing.3)-2px)] py-[calc(theme(spacing.1)-1px)] text-base has-[>svg+*]:pl-[calc(theme(spacing.2)-2px)] has-[>svg+*]:pr-[calc(theme(spacing.3)-1px)] has-[>svg:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>svg:only-child]:py-[calc(theme(spacing.2)-1px)] [&>svg]:size-4",
      lg: "px-[calc(theme(spacing.4)-1px)] py-[calc(theme(spacing.2)-1px)] text-lg has-[>svg+*]:pl-[calc(theme(spacing.3)-1px)] has-[>svg+*]:pr-[calc(theme(spacing.4)-1px)] has-[>svg:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>svg:only-child]:py-[calc(theme(spacing.2)-1px)] [&>svg]:size-5",
      xl: "px-[calc(theme(spacing.5)-1px)] py-[calc(theme(spacing.3)-1px)] text-xl has-[>svg+*]:pl-[calc(theme(spacing.4)-1px)] has-[>svg+*]:pr-[calc(theme(spacing.5)-1px)] has-[>svg:only-child]:px-[calc(theme(spacing.3)-1px)] has-[>svg:only-child]:py-[calc(theme(spacing.3)-1px)] [&>svg]:size-6",
      "icon-xs": "px-[calc(theme(spacing.1)-1px)] py-[calc(theme(spacing.1)-1px)] [&>svg]:size-4",
      "icon-sm":
        "px-[calc(theme(spacing.2)-1.5px)] py-[calc(theme(spacing.2)-1.5px)] [&>svg]:size-4",
      icon: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.2)-1px)] [&>svg]:size-5",
      "icon-lg": "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.2)-1px)] [&>svg]:size-5",
      "icon-xl": "px-[calc(theme(spacing.3)-1px)] py-[calc(theme(spacing.3)-1px)] [&>svg]:size-6",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
})

// Helper function for button-specific styling
const getButtonStyles = (variant: StyleVariant, colorScheme: ColorScheme): string[] => {
  // Get styles from shared system
  const colorStyles = getComponentStyles(colorScheme, variant, {
    componentType: "button",
    includeIcon: true,
    includePseudoElements: true,
  })

  // Combine with the base styles for the variant type
  let baseVariantStyles: string[] = []
  if (variant === "solid") {
    baseVariantStyles = solidBaseStyles
  } else if (variant === "outline") {
    // For outline buttons, add color-specific border for non-neutral colors
    const neutralColors = ["light", "dark/white", "dark", "zinc"]
    if (neutralColors.includes(colorScheme)) {
      baseVariantStyles = outlineBaseStyles
    } else {
      // Add color-specific border for colored schemes
      const colorBorder = `border-${colorScheme}-500`
      baseVariantStyles = [...outlineBaseStyles, colorBorder]
    }
  } else if (variant === "ghost") {
    baseVariantStyles = ghostBaseStyles
  }

  return [...baseVariantStyles, ...colorStyles]
}

// Define the props type using the new variants
interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">, // Omit HTML 'color' prop
    VariantProps<typeof buttonVariants> {
  // Includes 'variant' and 'size' from cva
  asChild?: boolean
  colorScheme?: ColorScheme // Add colorScheme prop
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size, colorScheme = "dark/white", asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"

    // Semantic variants use CSS theme variables directly; original variants use colorScheme system
    const isSemanticVariant =
      variant === "primary" || variant === "secondary" || variant === "destructive"
    const dynamicStyles = isSemanticVariant
      ? []
      : getButtonStyles(variant as StyleVariant, colorScheme)

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }), // Base cva styles
          dynamicStyles, // Variant + ColorScheme specific styles
          className, // Custom classes last for proper override precedence
        )}
        ref={ref}
        {...props}
      />
    )
  },
)

Button.displayName = "Button"

// Export the Button component and the variants object (optional)
export { Button, buttonVariants }
export type { ButtonProps, Variant as ButtonVariant, ColorScheme } // Export relevant types
