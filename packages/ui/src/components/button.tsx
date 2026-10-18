import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { getComponentStyles, type ColorScheme, type StyleVariant } from "../lib/color-variants"
import { cn } from "../lib/utils"

const baseButtonStyles = [
  "relative isolate inline-flex cursor-pointer items-center justify-center gap-x-2 rounded-md font-semibold whitespace-nowrap transition-colors",
  "has-[>svg+*]:gap-x-1.5",
  "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  "[&>svg]:shrink-0 [&>svg]:self-center forced-colors:[&>svg]:text-[ButtonText]",
]

const solidBaseStyles = [
  "border border-transparent",
  "before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:shadow-sm",
  "dark:border-white/5 dark:before:hidden",
  "after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:shadow-[inset_0_1px_theme(colors.white/15%)] dark:after:-inset-px",
  "disabled:before:shadow-none disabled:after:shadow-none",
]

const outlineBaseStyles = ["border"]

const ghostBaseStyles = ["border border-transparent"]

// Token-driven looks used when no colorScheme is given; they follow the active theme instead of the OS scheme.
const semanticStyles: Record<StyleVariant, string> = {
  solid: "",
  outline:
    "border border-input bg-transparent text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
  ghost:
    "border border-transparent bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
}

type Variant = StyleVariant | "primary" | "secondary" | "destructive"

const buttonVariants = cva(baseButtonStyles, {
  variants: {
    variant: {
      solid: "",
      outline: "",
      ghost: "",
      primary:
        "border border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
      secondary:
        "border border-input bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 active:bg-secondary/70",
      destructive:
        "border border-transparent bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/80",
    },
    size: {
      xs: "h-7 px-2 text-xs [&>svg]:size-3.5",
      sm: "h-8 px-3 text-sm [&>svg]:size-4",
      default: "h-9 px-4 text-base [&>svg]:size-4",
      lg: "h-10 px-5 text-lg [&>svg]:size-5",
      xl: "h-11 px-6 text-xl [&>svg]:size-6",
      "icon-xs": "size-7 p-0 [&>svg]:size-3.5",
      "icon-sm": "size-8 p-0 [&>svg]:size-4",
      icon: "size-9 p-0 [&>svg]:size-4",
      "icon-lg": "size-10 p-0 [&>svg]:size-5",
      "icon-xl": "size-11 p-0 [&>svg]:size-6",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
})

const getButtonStyles = (variant: StyleVariant, colorScheme: ColorScheme): string[] => {
  const colorStyles = getComponentStyles(colorScheme, variant, {
    componentType: "button",
    includeIcon: true,
    includePseudoElements: true,
  })

  let baseVariantStyles: string[] = []
  if (variant === "solid") {
    baseVariantStyles = solidBaseStyles
  } else if (variant === "outline") {
    const neutralColors = ["light", "dark/white", "dark", "zinc"]
    baseVariantStyles = neutralColors.includes(colorScheme)
      ? outlineBaseStyles
      : [...outlineBaseStyles, `border-${colorScheme}-500`]
  } else if (variant === "ghost") {
    baseVariantStyles = ghostBaseStyles
  }

  return [...baseVariantStyles, ...colorStyles]
}

interface ButtonStyleOptions extends VariantProps<typeof buttonVariants> {
  colorScheme?: ColorScheme
  className?: string
}

/**
 * Full class list for a button look. Use it to style links or other
 * elements as buttons without rendering `Button`.
 */
function buttonClassName({
  variant = "primary",
  size,
  colorScheme,
  className,
}: ButtonStyleOptions): string {
  const isStyleVariant = variant === "solid" || variant === "outline" || variant === "ghost"
  const dynamicStyles = !isStyleVariant
    ? []
    : colorScheme || variant === "solid"
      ? getButtonStyles(variant, colorScheme ?? "dark/white")
      : semanticStyles[variant]

  return cn(buttonVariants({ variant, size }), dynamicStyles, className)
}

interface ButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  colorScheme?: ColorScheme
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size, colorScheme, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={buttonClassName({ variant, size, colorScheme, className })}
        ref={ref}
        {...props}
      />
    )
  },
)

Button.displayName = "Button"

export { Button, buttonClassName, buttonVariants }
export type { ButtonProps, ButtonStyleOptions, Variant as ButtonVariant, ColorScheme }
