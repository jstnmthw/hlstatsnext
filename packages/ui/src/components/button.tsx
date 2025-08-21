import { Slot } from "@radix-ui/react-slot"
import { cn } from "../lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

// Base styles that apply to all button variants
const baseButtonStyles = [
  // Base
  "relative cursor-pointer isolate inline-flex items-baseline items-center justify-center gap-x-2 rounded-md border text-base/6 font-semibold",

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

// Solid button base styles - Keep only structural pseudo-elements
const solidBaseStyles = [
  "border-transparent", // Base border style

  // Structural before/after for solid buttons (backgrounds applied in colorVariants)
  "before:absolute before:inset-0 before:-z-10 before:rounded-[calc(theme(borderRadius.md)-1px)]",
  "before:shadow-sm", // Shadow for solid buttons
  "dark:before:hidden", // Hides the light-mode shadow in dark mode
  "dark:border dark:border-white/5", // Add subtle border in dark mode for solid
  "after:absolute after:inset-0 after:-z-10 after:rounded-[calc(theme(borderRadius.md)-1px)]",
  "after:shadow-[inset_0_1px_theme(colors.white/15%)]", // Inner highlight
  "dark:after:-inset-px", // Dark mode adjustment for highlight
  "disabled:before:shadow-none disabled:after:shadow-none", // Disabled state
]

// Outline button base styles - Should be mostly empty
const outlineBaseStyles: string[] = [
  // Base styles like border width/style if consistent, otherwise handled in colorVariants
]

// Plain button base styles (similar to ghost) - Should be mostly empty now
const plainBaseStyles = [
  "border-transparent", // Ensure no border for plain
]

// Define variant-specific styles for each color scheme using DIRECT Tailwind classes
const colorVariants = {
  light: {
    solid: [
      "text-zinc-950 bg-white border-zinc-950/10",
      "before:bg-white",
      "hover:after:bg-zinc-950/[2.5%] active:after:bg-zinc-950/[2.5%]",
      "dark:hover:after:bg-zinc-950/5 dark:active:after:bg-zinc-950/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-zinc-950/50 text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:border-zinc-100/10 dark:text-white dark:hover:bg-zinc-100/5 dark:active:bg-zinc-100/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-white",
    ],
    plain: [
      "text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:text-white dark:hover:bg-zinc-100/5 dark:active:bg-zinc-100/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-white",
    ],
  },
  "dark/white": {
    solid: [
      "text-white bg-zinc-900 border-zinc-950/90",
      "before:bg-zinc-900",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:text-zinc-950 dark:bg-white dark:border-zinc-950/10",
      "dark:hover:after:bg-zinc-950/5 dark:active:after:bg-zinc-950/5",
      "[&>[data-slot=icon]]:text-zinc-950 dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-zinc-950/30 text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:border-zinc-100/30 dark:text-white dark:hover:bg-zinc-100/5 dark:active:bg-zinc-100/10",
      "[&>[data-slot=icon]]:text-zinc-950 dark:[&>[data-slot=icon]]:text-white",
    ],
    plain: [
      "text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:text-white dark:hover:bg-zinc-100/5 dark:active:bg-zinc-100/10",
      "[&>[data-slot=icon]]:text-zinc-950 dark:[&>[data-slot=icon]]:text-white",
    ],
  },
  dark: {
    solid: [
      "text-white bg-zinc-900 border-zinc-950/90",
      "before:bg-zinc-900",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:text-white dark:bg-zinc-800 dark:border-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-zinc-950/30 text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:border-white/20 dark:text-white dark:hover:bg-white/5 dark:active:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-white",
    ],
    plain: [
      "text-zinc-950 hover:bg-zinc-950/[2.5%] active:bg-zinc-950/5",
      "dark:text-white dark:hover:bg-white/5 dark:active:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-white",
    ],
  },
  zinc: {
    solid: [
      "text-white bg-zinc-600 border-zinc-700/90",
      "before:bg-zinc-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-zinc-600/50 text-zinc-600 hover:bg-zinc-600/5 active:bg-zinc-600/10",
      "dark:border-zinc-400/50 dark:text-zinc-400 dark:hover:bg-zinc-400/5 dark:active:bg-zinc-400/10",
      "[&>[data-slot=icon]]:text-zinc-600 dark:[&>[data-slot=icon]]:text-zinc-400",
    ],
    plain: [
      "text-zinc-600 hover:bg-zinc-600/5 active:bg-zinc-600/10",
      "dark:text-zinc-400 dark:hover:bg-zinc-400/5 dark:active:bg-zinc-400/10",
      "[&>[data-slot=icon]]:text-zinc-600 dark:[&>[data-slot=icon]]:text-zinc-400",
    ],
  },
  green: {
    solid: [
      "text-white bg-green-600 border-green-700/90",
      "before:bg-green-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-green-600/50 text-green-600 hover:bg-green-600/5 active:bg-green-600/10",
      "dark:border-green-600/50 dark:text-green-600 dark:hover:bg-green-600/5 dark:active:bg-green-600/10",
      "[&>[data-slot=icon]]:text-green-600",
    ],
    plain: [
      "text-green-600 hover:bg-green-600/5 active:bg-green-600/10",
      "dark:text-green-600 dark:hover:bg-green-600/5 dark:active:bg-green-600/10",
      "[&>[data-slot=icon]]:text-green-600",
    ],
  },
  blue: {
    solid: [
      "text-white bg-blue-600 border-blue-700/90",
      "before:bg-blue-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-blue-600/50 text-blue-600 hover:bg-blue-600/5 active:bg-blue-600/10",
      "dark:border-blue-600/50 dark:text-blue-600 dark:hover:bg-blue-600/5 dark:active:bg-blue-600/10",
      "[&>[data-slot=icon]]:text-blue-600",
    ],
    plain: [
      "text-blue-600 hover:bg-blue-600/5 active:bg-blue-600/10",
      "dark:text-blue-600 dark:hover:bg-blue-600/5 dark:active:bg-blue-600/10",
      "[&>[data-slot=icon]]:text-blue-600",
    ],
  },
  red: {
    solid: [
      "text-white bg-red-600 border-red-700/90",
      "before:bg-red-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-red-600/50 text-red-600 hover:bg-red-600/5 active:bg-red-600/10",
      "dark:border-red-600/50 dark:text-red-600 dark:hover:bg-red-600/5 dark:active:bg-red-600/10",
      "[&>[data-slot=icon]]:text-red-600",
    ],
    plain: [
      "text-red-600 hover:bg-red-600/5 active:bg-red-600/10",
      "dark:text-red-600 dark:hover:bg-red-600/5 dark:active:bg-red-600/10",
      "[&>[data-slot=icon]]:text-red-600",
    ],
  },
  indigo: {
    solid: [
      "text-white bg-indigo-500 border-indigo-600/90",
      "before:bg-indigo-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-indigo-500/50 text-indigo-500 hover:bg-indigo-500/5 active:bg-indigo-500/10",
      "dark:border-indigo-500/50 dark:text-indigo-500 dark:hover:bg-indigo-500/5 dark:active:bg-indigo-500/10",
      "[&>[data-slot=icon]]:text-indigo-500",
    ],
    plain: [
      "text-indigo-500 hover:bg-indigo-500/5 active:bg-indigo-500/10",
      "dark:text-indigo-500 dark:hover:bg-indigo-500/5 dark:active:bg-indigo-500/10",
      "[&>[data-slot=icon]]:text-indigo-500",
    ],
  },
  cyan: {
    solid: [
      "text-cyan-950 bg-cyan-300 border-cyan-400/80",
      "before:bg-cyan-300",
      "hover:after:bg-white/25 active:after:bg-white/25",
      "dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/5 active:bg-cyan-500/10",
      "dark:border-cyan-500/50 dark:text-cyan-500 dark:hover:bg-cyan-500/5 dark:active:bg-cyan-500/10",
      "[&>[data-slot=icon]]:text-cyan-500",
    ],
    plain: [
      "text-cyan-500 hover:bg-cyan-500/5 active:bg-cyan-500/10",
      "dark:text-cyan-500 dark:hover:bg-cyan-500/5 dark:active:bg-cyan-500/10",
      "[&>[data-slot=icon]]:text-cyan-500",
    ],
  },
  orange: {
    solid: [
      "text-white bg-orange-500 border-orange-600/90",
      "before:bg-orange-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-orange-500/50 text-orange-500 hover:bg-orange-500/5 active:bg-orange-500/10",
      "dark:border-orange-500/50 dark:text-orange-500 dark:hover:bg-orange-500/5 dark:active:bg-orange-500/10",
      "[&>[data-slot=icon]]:text-orange-500",
    ],
    plain: [
      "text-orange-500 hover:bg-orange-500/5 active:bg-orange-500/10",
      "dark:text-orange-500 dark:hover:bg-orange-500/5 dark:active:bg-orange-500/10",
      "[&>[data-slot=icon]]:text-orange-500",
    ],
  },
  amber: {
    solid: [
      "text-amber-950 bg-amber-400 border-amber-500/80",
      "before:bg-amber-400",
      "hover:after:bg-white/25 active:after:bg-white/25",
      "dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-amber-500/50 text-amber-500 hover:bg-amber-500/5 active:bg-amber-500/10",
      "dark:border-amber-500/50 dark:text-amber-500 dark:hover:bg-amber-500/5 dark:active:bg-amber-500/10",
      "[&>[data-slot=icon]]:text-amber-500",
    ],
    plain: [
      "text-amber-500 hover:bg-amber-500/5 active:bg-amber-500/10",
      "dark:text-amber-500 dark:hover:bg-amber-500/5 dark:active:bg-amber-500/10",
      "[&>[data-slot=icon]]:text-amber-500",
    ],
  },
  yellow: {
    solid: [
      "text-yellow-950 bg-yellow-300 border-yellow-400/80",
      "before:bg-yellow-300",
      "hover:after:bg-white/25 active:after:bg-white/25",
      "dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/5 active:bg-yellow-500/10",
      "dark:border-yellow-500/50 dark:text-yellow-500 dark:hover:bg-yellow-500/5 dark:active:bg-yellow-500/10",
      "[&>[data-slot=icon]]:text-yellow-500",
    ],
    plain: [
      "text-yellow-500 hover:bg-yellow-500/5 active:bg-yellow-500/10",
      "dark:text-yellow-500 dark:hover:bg-yellow-500/5 dark:active:bg-yellow-500/10",
      "[&>[data-slot=icon]]:text-yellow-500",
    ],
  },
  lime: {
    solid: [
      "text-lime-950 bg-lime-300 border-lime-400/80",
      "before:bg-lime-300",
      "hover:after:bg-white/25 active:after:bg-white/25",
      "dark:hover:after:bg-white/10 dark:active:after:bg-white/10",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-lime-500/50 text-lime-500 hover:bg-lime-500/5 active:bg-lime-500/10",
      "dark:border-lime-500/50 dark:text-lime-500 dark:hover:bg-lime-500/5 dark:active:bg-lime-500/10",
      "[&>[data-slot=icon]]:text-lime-500",
    ],
    plain: [
      "text-lime-500 hover:bg-lime-500/5 active:bg-lime-500/10",
      "dark:text-lime-500 dark:hover:bg-lime-500/5 dark:active:bg-lime-500/10",
      "[&>[data-slot=icon]]:text-lime-500",
    ],
  },
  emerald: {
    solid: [
      "text-white bg-emerald-600 border-emerald-700/90",
      "before:bg-emerald-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-emerald-600/50 text-emerald-600 hover:bg-emerald-600/5 active:bg-emerald-600/10",
      "dark:border-emerald-600/50 dark:text-emerald-600 dark:hover:bg-emerald-600/5 dark:active:bg-emerald-600/10",
      "[&>[data-slot=icon]]:text-emerald-600",
    ],
    plain: [
      "text-emerald-600 hover:bg-emerald-600/5 active:bg-emerald-600/10",
      "dark:text-emerald-600 dark:hover:bg-emerald-600/5 dark:active:bg-emerald-600/10",
      "[&>[data-slot=icon]]:text-emerald-600",
    ],
  },
  teal: {
    solid: [
      "text-white bg-teal-600 border-teal-700/90",
      "before:bg-teal-600",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-teal-600/50 text-teal-600 hover:bg-teal-600/5 active:bg-teal-600/10",
      "dark:border-teal-600/50 dark:text-teal-600 dark:hover:bg-teal-600/5 dark:active:bg-teal-600/10",
      "[&>[data-slot=icon]]:text-teal-600",
    ],
    plain: [
      "text-teal-600 hover:bg-teal-600/5 active:bg-teal-600/10",
      "dark:text-teal-600 dark:hover:bg-teal-600/5 dark:active:bg-teal-600/10",
      "[&>[data-slot=icon]]:text-teal-600",
    ],
  },
  sky: {
    solid: [
      "text-white bg-sky-500 border-sky-600/80",
      "before:bg-sky-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-sky-500/50 text-sky-500 hover:bg-sky-500/5 active:bg-sky-500/10",
      "dark:border-sky-500/50 dark:text-sky-500 dark:hover:bg-sky-500/5 dark:active:bg-sky-500/10",
      "[&>[data-slot=icon]]:text-sky-500",
    ],
    plain: [
      "text-sky-500 hover:bg-sky-500/5 active:bg-sky-500/10",
      "dark:text-sky-500 dark:hover:bg-sky-500/5 dark:active:bg-sky-500/10",
      "[&>[data-slot=icon]]:text-sky-500",
    ],
  },
  violet: {
    solid: [
      "text-white bg-violet-500 border-violet-600/90",
      "before:bg-violet-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-violet-500/50 text-violet-500 hover:bg-violet-500/5 active:bg-violet-500/10",
      "dark:border-violet-500/50 dark:text-violet-500 dark:hover:bg-violet-500/5 dark:active:bg-violet-500/10",
      "[&>[data-slot=icon]]:text-violet-500",
    ],
    plain: [
      "text-violet-500 hover:bg-violet-500/5 active:bg-violet-500/10",
      "dark:text-violet-500 dark:hover:bg-violet-500/5 dark:active:bg-violet-500/10",
      "[&>[data-slot=icon]]:text-violet-500",
    ],
  },
  purple: {
    solid: [
      "text-white bg-purple-500 border-purple-600/90",
      "before:bg-purple-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-purple-500/50 text-purple-500 hover:bg-purple-500/5 active:bg-purple-500/10",
      "dark:border-purple-500/50 dark:text-purple-500 dark:hover:bg-purple-500/5 dark:active:bg-purple-500/10",
      "[&>[data-slot=icon]]:text-purple-500",
    ],
    plain: [
      "text-purple-500 hover:bg-purple-500/5 active:bg-purple-500/10",
      "dark:text-purple-500 dark:hover:bg-purple-500/5 dark:active:bg-purple-500/10",
      "[&>[data-slot=icon]]:text-purple-500",
    ],
  },
  fuchsia: {
    solid: [
      "text-white bg-fuchsia-500 border-fuchsia-600/90",
      "before:bg-fuchsia-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-fuchsia-500/50 text-fuchsia-500 hover:bg-fuchsia-500/5 active:bg-fuchsia-500/10",
      "dark:border-fuchsia-500/50 dark:text-fuchsia-500 dark:hover:bg-fuchsia-500/5 dark:active:bg-fuchsia-500/10",
      "[&>[data-slot=icon]]:text-fuchsia-500",
    ],
    plain: [
      "text-fuchsia-500 hover:bg-fuchsia-500/5 active:bg-fuchsia-500/10",
      "dark:text-fuchsia-500 dark:hover:bg-fuchsia-500/5 dark:active:bg-fuchsia-500/10",
      "[&>[data-slot=icon]]:text-fuchsia-500",
    ],
  },
  pink: {
    solid: [
      "text-white bg-pink-500 border-pink-600/90",
      "before:bg-pink-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-pink-500/50 text-pink-500 hover:bg-pink-500/5 active:bg-pink-500/10",
      "dark:border-pink-500/50 dark:text-pink-500 dark:hover:bg-pink-500/5 dark:active:bg-pink-500/10",
      "[&>[data-slot=icon]]:text-pink-500",
    ],
    plain: [
      "text-pink-500 hover:bg-pink-500/5 active:bg-pink-500/10",
      "dark:text-pink-500 dark:hover:bg-pink-500/5 dark:active:bg-pink-500/10",
      "[&>[data-slot=icon]]:text-pink-500",
    ],
  },
  rose: {
    solid: [
      "text-white bg-rose-500 border-rose-600/90",
      "before:bg-rose-500",
      "hover:after:bg-white/10 active:after:bg-white/10",
      "dark:hover:after:bg-white/5 dark:active:after:bg-white/5",
      "[&>[data-slot=icon]]:text-white dark:[&>[data-slot=icon]]:text-zinc-50",
    ],
    outline: [
      "border-rose-500/50 text-rose-500 hover:bg-rose-500/5 active:bg-rose-500/10",
      "dark:border-rose-500/50 dark:text-rose-500 dark:hover:bg-rose-500/5 dark:active:bg-rose-500/10",
      "[&>[data-slot=icon]]:text-rose-500",
    ],
    plain: [
      "text-rose-500 hover:bg-rose-500/5 active:bg-rose-500/10",
      "dark:text-rose-500 dark:hover:bg-rose-500/5 dark:active:bg-rose-500/10",
      "[&>[data-slot=icon]]:text-rose-500",
    ],
  },
}

// Type for the colorVariants to use in getButtonStyles
type ColorVariants = typeof colorVariants
type ColorScheme = keyof ColorVariants
type Variant = "solid" | "outline" | "plain"

// cva for base styles and sizing (Remove icon color styles)
const buttonVariants = cva(baseButtonStyles, {
  variants: {
    variant: {
      // These are now primarily markers for the getButtonStyles logic,
      // but could potentially hold base structural styles per variant if needed
      // (e.g., if solid always had a specific shadow independent of color)
      solid: "",
      outline: "",
      plain: "",
    },
    size: {
      // Regular sizes with automatic icon-only detection
      xs: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-3px)] text-xs/6 has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.1)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.1)-1px)] [&>[data-slot=icon]]:size-4",
      sm: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.1)-2px)] text-sm/6 has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1.5px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1.5px)] [&>[data-slot=icon]]:size-4",
      default:
        "px-[calc(theme(spacing.3)-2px)] py-[calc(theme(spacing.1)-1px)] text-sm/6 has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-2px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-4",
      lg: "px-[calc(theme(spacing.2)-1px)] py-[calc(theme(spacing.2)-1px)] text-base/6 has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.2)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.2)-1px)] [&>[data-slot=icon]]:size-5",
      xl: "px-[calc(theme(spacing.3)-1px)] py-[calc(theme(spacing.3)-1px)] text-base/6 has-[>[data-slot=icon]+*]:pl-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]+*]:pr-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:px-[calc(theme(spacing.3)-1px)] has-[>[data-slot=icon]:only-child]:py-[calc(theme(spacing.3)-1px)] [&>[data-slot=icon]]:size-6",
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

// Helper function - Simplified: now just retrieves classes from colorVariants
const getButtonStyles = (variant: Variant, colorScheme: ColorScheme): string[] => {
  const colorStyles = colorVariants[colorScheme]?.[variant] || []

  // Fallback remains the same conceptually, but retrieves refactored classes
  if (colorStyles.length === 0) {
    console.warn(
      `Button styles not found for variant='${variant}' colorScheme='${colorScheme}'. Falling back.`,
    )
    // Fallback to dark variant's styles (adjust if needed)
    return colorVariants["dark"]?.[variant] || []
  }

  // Combine with the base styles for the variant type IF they exist and are needed
  // If base styles become empty, this part can be removed.
  let baseVariantStyles: string[] = []
  if (variant === "solid") {
    baseVariantStyles = solidBaseStyles
  } else if (variant === "outline") {
    baseVariantStyles = outlineBaseStyles
  } else if (variant === "plain") {
    baseVariantStyles = plainBaseStyles
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

    // Get the specific variant+colorScheme styles using the helper
    // getButtonStyles now returns the refactored direct classes + base variant structural classes
    const dynamicStyles = getButtonStyles(variant!, colorScheme)

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }), // Base cva styles (layout, focus, disabled, size)
          dynamicStyles, // Variant + ColorScheme specific styles from getButtonStyles
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
