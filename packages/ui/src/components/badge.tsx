import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { getComponentStyles, type ColorScheme, type StyleVariant } from "../lib/color-variants"
import { cn } from "../lib/utils"

type Variant = StyleVariant | "primary" | "secondary" | "destructive" | "live" | "muted"

const badgeVariants = cva(
  "inline-flex h-4 w-fit shrink-0 items-center justify-center gap-1 rounded-[4px] border px-1.5 text-xs leading-none font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        solid: "",
        outline: "",
        ghost: "",
        primary:
          "border-transparent bg-primary font-bold text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        live: "border-transparent bg-secondary text-primary-bright",
        muted: "border-transparent bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
)

// Token-driven looks used when no colorScheme is given.
const semanticStyles: Record<StyleVariant, string> = {
  solid: "",
  outline: "border-input bg-transparent text-muted-foreground",
  ghost: "border-transparent bg-transparent text-foreground",
}

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

interface BadgeStyleOptions extends VariantProps<typeof badgeVariants> {
  colorScheme?: ColorScheme
  asChild?: boolean
  className?: string
}

function badgeClassName({
  variant = "primary",
  colorScheme,
  asChild = false,
  className,
}: BadgeStyleOptions): string {
  const isStyleVariant = variant === "solid" || variant === "outline" || variant === "ghost"
  const dynamicStyles = !isStyleVariant
    ? []
    : colorScheme || variant === "solid"
      ? getBadgeStyles(variant, colorScheme ?? "dark/white", asChild)
      : semanticStyles[variant]

  return cn(badgeVariants({ variant }), dynamicStyles, className)
}

interface BadgeProps
  extends Omit<React.ComponentProps<"span">, "color">, VariantProps<typeof badgeVariants> {
  asChild?: boolean
  colorScheme?: ColorScheme
}

function Badge({
  className,
  variant = "primary",
  colorScheme,
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={badgeClassName({ variant, colorScheme, asChild, className })}
      {...props}
    />
  )
}

export { Badge, badgeClassName, badgeVariants }
export type { BadgeProps, BadgeStyleOptions, Variant as BadgeVariant, ColorScheme }
