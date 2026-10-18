import type { CSSProperties } from "react"

export const TIERS = ["recruit", "regular", "veteran", "elite", "legend"] as const

export type Tier = (typeof TIERS)[number]

export const tierLabels: Record<Tier, string> = {
  recruit: "Recruit",
  regular: "Regular",
  veteran: "Veteran",
  elite: "Elite",
  legend: "Legend",
}

export interface TierPalette {
  name: string
  colors: Record<Tier, string>
}

/**
 * Ladder colour sets. `royal` is the default baked into globals.css; the
 * others are alternatives an operator can pick. Apply one with
 * `tierPaletteStyle()` on any ancestor element.
 */
export const tierPalettes = {
  royal: {
    name: "Royal",
    colors: {
      recruit: "#9aa39a",
      regular: "#22c55e",
      veteran: "#3d8bff",
      elite: "#b04bff",
      legend: "#ffa91a",
    },
  },
  loot: {
    name: "Loot",
    colors: {
      recruit: "#8f948f",
      regular: "#38bdf8",
      veteran: "#a78bfa",
      elite: "#fb923c",
      legend: "#fbbf24",
    },
  },
  metals: {
    name: "Metals",
    colors: {
      recruit: "#8a8f94",
      regular: "#cd7f32",
      veteran: "#c0c7cf",
      elite: "#fbbf24",
      legend: "#9be7ff",
    },
  },
  heat: {
    name: "Heat",
    colors: {
      recruit: "#64748b",
      regular: "#2dd4bf",
      veteran: "#f59e0b",
      elite: "#ef4444",
      legend: "#fde68a",
    },
  },
  neon: {
    name: "Neon",
    colors: {
      recruit: "#737373",
      regular: "#22d3ee",
      veteran: "#e879f9",
      elite: "#fb7185",
      legend: "#facc15",
    },
  },
  arcade: {
    name: "Arcade",
    colors: {
      recruit: "#9ca3af",
      regular: "#4ade80",
      veteran: "#60a5fa",
      elite: "#f472b6",
      legend: "#fcd34d",
    },
  },
  ocean: {
    name: "Ocean",
    colors: {
      recruit: "#8b9aa8",
      regular: "#22d3ee",
      veteran: "#3b82f6",
      elite: "#8b5cf6",
      legend: "#f0abfc",
    },
  },
  ember: {
    name: "Ember",
    colors: {
      recruit: "#8f948f",
      regular: "#fbbf24",
      veteran: "#f97316",
      elite: "#ef4444",
      legend: "#fde047",
    },
  },
  frost: {
    name: "Frost",
    colors: {
      recruit: "#94a3b8",
      regular: "#67e8f9",
      veteran: "#a5b4fc",
      elite: "#e9d5ff",
      legend: "#ffffff",
    },
  },
  cyber: {
    name: "Cyber",
    colors: {
      recruit: "#6b7280",
      regular: "#a3e635",
      veteran: "#2dd4bf",
      elite: "#d946ef",
      legend: "#fef08a",
    },
  },
} as const satisfies Record<string, TierPalette>

export type TierPaletteName = keyof typeof tierPalettes

export const tierPaletteNames = Object.keys(tierPalettes) as TierPaletteName[]

/** CSS custom properties that recolour every tier-aware component beneath the element they are set on. */
export function tierPaletteStyle(palette: TierPaletteName | TierPalette): CSSProperties {
  const { colors } = typeof palette === "string" ? tierPalettes[palette] : palette
  return Object.fromEntries(TIERS.map((tier) => [`--tier-${tier}`, colors[tier]])) as CSSProperties
}

// Literal class names so Tailwind's scanner picks them up.
export const tierTextClass: Record<Tier, string> = {
  recruit: "text-tier-recruit",
  regular: "text-tier-regular",
  veteran: "text-tier-veteran",
  elite: "text-tier-elite",
  legend: "text-tier-legend",
}

export const tierBgClass: Record<Tier, string> = {
  recruit: "bg-tier-recruit",
  regular: "bg-tier-regular",
  veteran: "bg-tier-veteran",
  elite: "bg-tier-elite",
  legend: "bg-tier-legend",
}

export const tierBorderClass: Record<Tier, string> = {
  recruit: "border-tier-recruit/50",
  regular: "border-tier-regular/50",
  veteran: "border-tier-veteran/50",
  elite: "border-tier-elite/50",
  legend: "border-tier-legend/50",
}
