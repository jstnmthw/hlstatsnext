/**
 * Shared color variant system for UI components
 * Extracted from button component to enable consistent styling across components
 */

export type ColorScheme =
  | "light"
  | "dark/white"
  | "dark"
  | "zinc"
  | "green"
  | "blue"
  | "red"
  | "indigo"
  | "cyan"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "emerald"
  | "teal"
  | "sky"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose"

export type StyleVariant = "solid" | "outline" | "ghost"

export interface ComponentColorConfig {
  text: string
  background?: string
  border?: string
  hover?: {
    background?: string
    text?: string
    border?: string
  }
  active?: {
    background?: string
    text?: string
    border?: string
  }
  icon?: string
  before?: string // For pseudo-elements like button backgrounds
  after?: string // For pseudo-elements like button overlays
}

/**
 * Base color definitions - these provide the core color values for each scheme and variant
 */
const baseColorVariants: Record<ColorScheme, Record<StyleVariant, ComponentColorConfig>> = {
  light: {
    solid: {
      text: "text-zinc-950",
      background: "bg-white",
      border: "border-zinc-950/10",
      hover: { background: "hover:bg-zinc-50" },
      active: { background: "active:bg-zinc-100" },
      icon: "text-zinc-950",
      before: "before:bg-white",
      after:
        "hover:after:bg-zinc-950/[2.5%] active:after:bg-zinc-950/[2.5%] dark:hover:after:bg-zinc-950/5 dark:active:after:bg-zinc-950/5",
    },
    outline: {
      text: "text-zinc-950 dark:text-white",
      border: "border-zinc-950/50 dark:border-zinc-100/10",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-zinc-100/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-zinc-100/10" },
      icon: "text-zinc-950 dark:text-white",
    },
    ghost: {
      text: "text-zinc-950 dark:text-white",
      border: "border-transparent",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-zinc-100/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-zinc-100/10" },
      icon: "text-zinc-950 dark:text-white",
    },
  },
  "dark/white": {
    solid: {
      text: "text-white dark:text-zinc-950",
      background: "bg-zinc-900 dark:bg-white",
      border: "border-zinc-950/90 dark:border-zinc-950/10",
      hover: { background: "hover:bg-zinc-800 dark:hover:bg-zinc-50" },
      active: { background: "active:bg-zinc-800 dark:active:bg-zinc-100" },
      icon: "text-white dark:text-zinc-950",
      before: "before:bg-zinc-900 dark:before:bg-white",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-zinc-950/5 dark:active:after:bg-zinc-950/5",
    },
    outline: {
      text: "text-zinc-950 dark:text-white",
      border: "border-zinc-950/30 dark:border-zinc-100/30",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-zinc-100/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-zinc-100/10" },
      icon: "text-zinc-950 dark:text-white",
    },
    ghost: {
      text: "text-zinc-950 dark:text-white",
      border: "border-transparent",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-zinc-100/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-zinc-100/10" },
      icon: "text-zinc-950 dark:text-white",
    },
  },
  dark: {
    solid: {
      text: "text-white",
      background: "bg-zinc-900 dark:bg-zinc-800",
      border: "border-zinc-950/90 dark:border-white/10",
      hover: { background: "hover:bg-zinc-800 dark:hover:bg-zinc-700" },
      active: { background: "active:bg-zinc-800 dark:active:bg-zinc-700" },
      icon: "text-white",
      before: "before:bg-zinc-900 dark:before:bg-zinc-800",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-zinc-950 dark:text-white",
      border: "border-zinc-950/30 dark:border-white/20",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-white/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-white/10" },
      icon: "text-zinc-950 dark:text-white",
    },
    ghost: {
      text: "text-zinc-950 dark:text-white",
      border: "border-transparent",
      hover: { background: "hover:bg-zinc-950/[2.5%] dark:hover:bg-white/5" },
      active: { background: "active:bg-zinc-950/5 dark:active:bg-white/10" },
      icon: "text-zinc-950 dark:text-white",
    },
  },
  zinc: {
    solid: {
      text: "text-white",
      background: "bg-zinc-600",
      border: "border-zinc-700/90",
      hover: { background: "hover:bg-zinc-700" },
      active: { background: "active:bg-zinc-700" },
      icon: "text-white",
      before: "before:bg-zinc-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-zinc-600 dark:text-zinc-400",
      border: "border-zinc-600/50 dark:border-zinc-400/50",
      hover: { background: "hover:bg-zinc-600/5 dark:hover:bg-zinc-400/5" },
      active: { background: "active:bg-zinc-600/10 dark:active:bg-zinc-400/10" },
      icon: "text-zinc-600 dark:text-zinc-400",
    },
    ghost: {
      text: "text-zinc-600 dark:text-zinc-400",
      border: "border-transparent",
      hover: { background: "hover:bg-zinc-600/5 dark:hover:bg-zinc-400/5" },
      active: { background: "active:bg-zinc-600/10 dark:active:bg-zinc-400/10" },
      icon: "text-zinc-600 dark:text-zinc-400",
    },
  },
  green: {
    solid: {
      text: "text-white",
      background: "bg-green-600",
      border: "border-green-700/90",
      hover: { background: "hover:bg-green-700" },
      active: { background: "active:bg-green-700" },
      icon: "text-white",
      before: "before:bg-green-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-green-600",
      hover: { background: "hover:bg-green-600/5" },
      active: { background: "active:bg-green-600/10" },
      icon: "text-green-600",
    },
    ghost: {
      text: "text-green-600",
      border: "border-transparent",
      hover: { background: "hover:bg-green-600/5" },
      active: { background: "active:bg-green-600/10" },
      icon: "text-green-600",
    },
  },
  blue: {
    solid: {
      text: "text-white",
      background: "bg-blue-600",
      border: "border-blue-700/90",
      hover: { background: "hover:bg-blue-700" },
      active: { background: "active:bg-blue-700" },
      icon: "text-white",
      before: "before:bg-blue-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-blue-600",
      hover: { background: "hover:bg-blue-600/5" },
      active: { background: "active:bg-blue-600/10" },
      icon: "text-blue-600",
    },
    ghost: {
      text: "text-blue-600",
      border: "border-transparent",
      hover: { background: "hover:bg-blue-600/5" },
      active: { background: "active:bg-blue-600/10" },
      icon: "text-blue-600",
    },
  },
  red: {
    solid: {
      text: "text-white",
      background: "bg-red-600",
      border: "border-red-700/90",
      hover: { background: "hover:bg-red-700" },
      active: { background: "active:bg-red-700" },
      icon: "text-white",
      before: "before:bg-red-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-red-600",
      hover: { background: "hover:bg-red-600/5" },
      active: { background: "active:bg-red-600/10" },
      icon: "text-red-600",
    },
    ghost: {
      text: "text-red-600",
      border: "border-transparent",
      hover: { background: "hover:bg-red-600/5" },
      active: { background: "active:bg-red-600/10" },
      icon: "text-red-600",
    },
  },
  indigo: {
    solid: {
      text: "text-white",
      background: "bg-indigo-500",
      border: "border-indigo-600/90",
      hover: { background: "hover:bg-indigo-600" },
      active: { background: "active:bg-indigo-600" },
      icon: "text-white",
      before: "before:bg-indigo-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-indigo-500",
      hover: { background: "hover:bg-indigo-500/5" },
      active: { background: "active:bg-indigo-500/10" },
      icon: "text-indigo-500",
    },
    ghost: {
      text: "text-indigo-500",
      border: "border-transparent",
      hover: { background: "hover:bg-indigo-500/5" },
      active: { background: "active:bg-indigo-500/10" },
      icon: "text-indigo-500",
    },
  },
  cyan: {
    solid: {
      text: "text-cyan-950",
      background: "bg-cyan-300",
      border: "border-cyan-400/80",
      hover: { background: "hover:bg-cyan-400" },
      active: { background: "active:bg-cyan-400" },
      icon: "text-cyan-950",
      before: "before:bg-cyan-300",
      after:
        "hover:after:bg-white/25 active:after:bg-white/25 dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
    },
    outline: {
      text: "text-cyan-500",
      hover: { background: "hover:bg-cyan-500/5" },
      active: { background: "active:bg-cyan-500/10" },
      icon: "text-cyan-500",
    },
    ghost: {
      text: "text-cyan-500",
      border: "border-transparent",
      hover: { background: "hover:bg-cyan-500/5" },
      active: { background: "active:bg-cyan-500/10" },
      icon: "text-cyan-500",
    },
  },
  orange: {
    solid: {
      text: "text-white",
      background: "bg-orange-500",
      border: "border-orange-600/90",
      hover: { background: "hover:bg-orange-600" },
      active: { background: "active:bg-orange-600" },
      icon: "text-white",
      before: "before:bg-orange-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-orange-500",
      hover: { background: "hover:bg-orange-500/5" },
      active: { background: "active:bg-orange-500/10" },
      icon: "text-orange-500",
    },
    ghost: {
      text: "text-orange-500",
      border: "border-transparent",
      hover: { background: "hover:bg-orange-500/5" },
      active: { background: "active:bg-orange-500/10" },
      icon: "text-orange-500",
    },
  },
  amber: {
    solid: {
      text: "text-amber-950",
      background: "bg-amber-400",
      border: "border-amber-500/80",
      hover: { background: "hover:bg-amber-500" },
      active: { background: "active:bg-amber-500" },
      icon: "text-amber-950",
      before: "before:bg-amber-400",
      after:
        "hover:after:bg-white/25 active:after:bg-white/25 dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
    },
    outline: {
      text: "text-amber-500",
      hover: { background: "hover:bg-amber-500/5" },
      active: { background: "active:bg-amber-500/10" },
      icon: "text-amber-500",
    },
    ghost: {
      text: "text-amber-500",
      border: "border-transparent",
      hover: { background: "hover:bg-amber-500/5" },
      active: { background: "active:bg-amber-500/10" },
      icon: "text-amber-500",
    },
  },
  yellow: {
    solid: {
      text: "text-yellow-950",
      background: "bg-yellow-300",
      border: "border-yellow-400/80",
      hover: { background: "hover:bg-yellow-400" },
      active: { background: "active:bg-yellow-400" },
      icon: "text-yellow-950",
      before: "before:bg-yellow-300",
      after:
        "hover:after:bg-white/25 active:after:bg-white/25 dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
    },
    outline: {
      text: "text-yellow-500",
      hover: { background: "hover:bg-yellow-500/5" },
      active: { background: "active:bg-yellow-500/10" },
      icon: "text-yellow-500",
    },
    ghost: {
      text: "text-yellow-500",
      border: "border-transparent",
      hover: { background: "hover:bg-yellow-500/5" },
      active: { background: "active:bg-yellow-500/10" },
      icon: "text-yellow-500",
    },
  },
  lime: {
    solid: {
      text: "text-lime-950",
      background: "bg-lime-300",
      border: "border-lime-400/80",
      hover: { background: "hover:bg-lime-400" },
      active: { background: "active:bg-lime-400" },
      icon: "text-lime-950",
      before: "before:bg-lime-300",
      after:
        "hover:after:bg-white/25 active:after:bg-white/25 dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
    },
    outline: {
      text: "text-lime-500",
      hover: { background: "hover:bg-lime-500/5" },
      active: { background: "active:bg-lime-500/10" },
      icon: "text-lime-500",
    },
    ghost: {
      text: "text-lime-500",
      border: "border-transparent",
      hover: { background: "hover:bg-lime-500/5" },
      active: { background: "active:bg-lime-500/10" },
      icon: "text-lime-500",
    },
  },
  emerald: {
    solid: {
      text: "text-white",
      background: "bg-emerald-600",
      border: "border-emerald-700/90",
      hover: { background: "hover:bg-emerald-700" },
      active: { background: "active:bg-emerald-700" },
      icon: "text-white",
      before: "before:bg-emerald-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-emerald-600",
      hover: { background: "hover:bg-emerald-600/5" },
      active: { background: "active:bg-emerald-600/10" },
      icon: "text-emerald-600",
    },
    ghost: {
      text: "text-emerald-600",
      border: "border-transparent",
      hover: { background: "hover:bg-emerald-600/5" },
      active: { background: "active:bg-emerald-600/10" },
      icon: "text-emerald-600",
    },
  },
  teal: {
    solid: {
      text: "text-white",
      background: "bg-teal-600",
      border: "border-teal-700/90",
      hover: { background: "hover:bg-teal-700" },
      active: { background: "active:bg-teal-700" },
      icon: "text-white",
      before: "before:bg-teal-600",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-teal-600",
      hover: { background: "hover:bg-teal-600/5" },
      active: { background: "active:bg-teal-600/10" },
      icon: "text-teal-600",
    },
    ghost: {
      text: "text-teal-600",
      border: "border-transparent",
      hover: { background: "hover:bg-teal-600/5" },
      active: { background: "active:bg-teal-600/10" },
      icon: "text-teal-600",
    },
  },
  sky: {
    solid: {
      text: "text-white",
      background: "bg-sky-500",
      border: "border-sky-600/80",
      hover: { background: "hover:bg-sky-600" },
      active: { background: "active:bg-sky-600" },
      icon: "text-white",
      before: "before:bg-sky-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-sky-500",
      hover: { background: "hover:bg-sky-500/5" },
      active: { background: "active:bg-sky-500/10" },
      icon: "text-sky-500",
    },
    ghost: {
      text: "text-sky-500",
      border: "border-transparent",
      hover: { background: "hover:bg-sky-500/5" },
      active: { background: "active:bg-sky-500/10" },
      icon: "text-sky-500",
    },
  },
  violet: {
    solid: {
      text: "text-white",
      background: "bg-violet-500",
      border: "border-violet-600/90",
      hover: { background: "hover:bg-violet-600" },
      active: { background: "active:bg-violet-600" },
      icon: "text-white",
      before: "before:bg-violet-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-violet-500",
      hover: { background: "hover:bg-violet-500/5" },
      active: { background: "active:bg-violet-500/10" },
      icon: "text-violet-500",
    },
    ghost: {
      text: "text-violet-500",
      border: "border-transparent",
      hover: { background: "hover:bg-violet-500/5" },
      active: { background: "active:bg-violet-500/10" },
      icon: "text-violet-500",
    },
  },
  purple: {
    solid: {
      text: "text-white",
      background: "bg-purple-500",
      border: "border-purple-600/90",
      hover: { background: "hover:bg-purple-600" },
      active: { background: "active:bg-purple-600" },
      icon: "text-white",
      before: "before:bg-purple-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-purple-500",
      hover: { background: "hover:bg-purple-500/5" },
      active: { background: "active:bg-purple-500/10" },
      icon: "text-purple-500",
    },
    ghost: {
      text: "text-purple-500",
      border: "border-transparent",
      hover: { background: "hover:bg-purple-500/5" },
      active: { background: "active:bg-purple-500/10" },
      icon: "text-purple-500",
    },
  },
  fuchsia: {
    solid: {
      text: "text-white",
      background: "bg-fuchsia-500",
      border: "border-fuchsia-600/90",
      hover: { background: "hover:bg-fuchsia-600" },
      active: { background: "active:bg-fuchsia-600" },
      icon: "text-white",
      before: "before:bg-fuchsia-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-fuchsia-500",
      hover: { background: "hover:bg-fuchsia-500/5" },
      active: { background: "active:bg-fuchsia-500/10" },
      icon: "text-fuchsia-500",
    },
    ghost: {
      text: "text-fuchsia-500",
      border: "border-transparent",
      hover: { background: "hover:bg-fuchsia-500/5" },
      active: { background: "active:bg-fuchsia-500/10" },
      icon: "text-fuchsia-500",
    },
  },
  pink: {
    solid: {
      text: "text-white",
      background: "bg-pink-500",
      border: "border-pink-600/90",
      hover: { background: "hover:bg-pink-600" },
      active: { background: "active:bg-pink-600" },
      icon: "text-white",
      before: "before:bg-pink-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-pink-500",
      hover: { background: "hover:bg-pink-500/5" },
      active: { background: "active:bg-pink-500/10" },
      icon: "text-pink-500",
    },
    ghost: {
      text: "text-pink-500",
      border: "border-transparent",
      hover: { background: "hover:bg-pink-500/5" },
      active: { background: "active:bg-pink-500/10" },
      icon: "text-pink-500",
    },
  },
  rose: {
    solid: {
      text: "text-white",
      background: "bg-rose-500",
      border: "border-rose-600/90",
      hover: { background: "hover:bg-rose-600" },
      active: { background: "active:bg-rose-600" },
      icon: "text-white",
      before: "before:bg-rose-500",
      after:
        "hover:after:bg-white/10 active:after:bg-white/10 dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
    },
    outline: {
      text: "text-rose-500",
      hover: { background: "hover:bg-rose-500/5" },
      active: { background: "active:bg-rose-500/10" },
      icon: "text-rose-500",
    },
    ghost: {
      text: "text-rose-500",
      border: "border-transparent",
      hover: { background: "hover:bg-rose-500/5" },
      active: { background: "active:bg-rose-500/10" },
      icon: "text-rose-500",
    },
  },
}

/**
 * Component-specific style generators
 */
export interface ComponentStyleOptions {
  componentType: "button" | "badge"
  includeHover?: boolean
  includeActive?: boolean
  includeFocus?: boolean
  includeIcon?: boolean
  includePseudoElements?: boolean
}

/**
 * Generate CSS classes for a component based on color scheme and variant
 */
export function getComponentStyles(
  colorScheme: ColorScheme,
  variant: StyleVariant,
  options: ComponentStyleOptions = { componentType: "button" },
): string[] {
  const config = baseColorVariants[colorScheme]?.[variant]

  if (!config) {
    console.warn(
      `Color styles not found for variant='${variant}' colorScheme='${colorScheme}'. Falling back to dark/white.`,
    )
    return getComponentStyles("dark/white", variant, options)
  }

  const styles: string[] = []

  // Add base styles
  if (config.text) styles.push(config.text)
  if (config.background) styles.push(config.background)
  if (config.border) styles.push(config.border)

  // Add interaction styles based on component type and options
  if (options.includeHover !== false && config.hover) {
    if (config.hover.background) {
      if (options.componentType === "badge") {
        // For badges, use [a&]: prefix to only apply hover on anchor elements
        styles.push(`[a&]:${config.hover.background}`)
      } else {
        styles.push(config.hover.background)
      }
    }
    if (config.hover.text) styles.push(config.hover.text)
    if (config.hover.border) styles.push(config.hover.border)
  }

  if (options.includeActive !== false && config.active) {
    if (config.active.background) {
      if (options.componentType === "badge") {
        styles.push(`[a&]:${config.active.background}`)
      } else {
        styles.push(config.active.background)
      }
    }
    if (config.active.text) styles.push(config.active.text)
    if (config.active.border) styles.push(config.active.border)
  }

  // Add icon styles if requested
  if (options.includeIcon && config.icon) {
    if (options.componentType === "button") {
      styles.push(`[&>[data-slot=icon]]:${config.icon}`)
    } else if (options.componentType === "badge") {
      styles.push(`[&>svg]:${config.icon}`)
    }
  }

  // Add pseudo-element styles (primarily for buttons)
  if (options.includePseudoElements && options.componentType === "button") {
    if (config.before) styles.push(config.before)
    if (config.after) styles.push(config.after)
  }

  return styles
}
