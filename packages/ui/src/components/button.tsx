import { Slot } from "@radix-ui/react-slot"
import { cn } from "../lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { type ColorScheme, type StyleVariant, getComponentStyles } from "../lib/color-variants"

// Base styles that apply to all button variants
const baseButtonStyles = [
  // Base (removed 'border' - let variants control it explicitly)
  "relative cursor-pointer isolate inline-flex items-baseline items-center justify-center gap-x-2 rounded-md text-base font-semibold",

  // Reduce gap when there's both icon and text
  "has-[>[data-slot=icon]+*]:gap-x-1.5",

  // Focus
  "focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500",

  // Disabled
  "disabled:opacity-50 disabled:pointer-events-none",

  // Icon Base Styling (Sizing/Margins handled in size variants)
  "[&>[data-slot=icon]]:shrink-0 [&>[data-slot=icon]]:self-center",

  // Icon colors handled per variant/scheme below
  "forced-colors:[&>[data-slot=icon]]:text-[ButtonText]",
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
type Variant = StyleVariant

// cva for base styles and sizing (Remove icon color styles)
const buttonVariants = cva(baseButtonStyles, {
  variants: {
    variant: {
      // Markers for the getButtonStyles logic
      solid: "",
      outline: "",
      ghost: "",
    },
    size: {
      // Regular sizes with automatic icon-only detection - now using 2px increment font scale
      xs: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-1px)] text-xs has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.1)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.1)-1px)] [&>[data-slot=icon]]:size-4",
      sm: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-1px)] text-sm has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1.5px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1.5px)] [&>[data-slot=icon]]:size-4",
      default:
        "px-[calc(theme(spacing.3)-2px)] py-[calc(theme(spacing.1)-1px)] text-base has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-2px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-4",
      lg: "px-[calc(theme(spacing.4)-1px)] py-[calc(theme(spacing.2)-1px)] text-lg has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.4)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-5",
      xl: "px-[calc(theme(spacing.5)-1px)] py-[calc(theme(spacing.3)-1px)] text-xl has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.4)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.5)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.3)-1px)] [&>[data-slot=icon]]:size-6",
      "icon-xs":
        "px-[calc(theme(spacing.1)-1px)] py-[calc(theme(spacing.1)-1px)] [&>[data-slot=icon]]:size-4",
      "icon-sm":
        "px-[calc(theme(spacing.2)-1.5px)] py-[calc(theme(spacing.2)-1.5px)] [&>[data-slot=icon]]:size-4",
      icon: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-5",
      "icon-lg":
        "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-5",
      "icon-xl":
        "px-[calc(theme(spacing.3)-1px)] py-[calc(theme(spacing.3)-1px)] [&>[data-slot=icon]]:size-6",
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "default",
  },
})

// Helper function for button-specific styling
const getButtonStyles = (variant: Variant, colorScheme: ColorScheme): string[] => {
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
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">, // Omit HTML 'color' prop
    VariantProps<typeof buttonVariants> {
  // Includes 'variant' and 'size' from cva
  asChild?: boolean
  colorScheme?: ColorScheme // Add colorScheme prop
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "solid", size, colorScheme = "dark/white", asChild = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"

    // Get the specific variant+colorScheme styles
    const dynamicStyles = getButtonStyles(variant!, colorScheme)

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
