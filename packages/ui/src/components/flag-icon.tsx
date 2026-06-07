import * as React from "react"
import { cn } from "../lib/utils"

export interface FlagIconProps extends Omit<React.ComponentProps<"span">, "color"> {
  /**
   * ISO 3166-1 alpha-2 country code, any case (e.g. "th", "TH").
   * Maps to `Player.flag`. Renders nothing when empty/unknown.
   */
  code?: string | null
  /**
   * Full country name used as the accessible label / hover tooltip
   * (e.g. "Thailand"). Maps to `Player.country`. Falls back to the code.
   */
  name?: string | null
}

/**
 * Renders a 16x11 famfamfam pixel flag from the vendored sprite. The sprite
 * (`/flags/famfamfam-flags.png`) and its CSS classes ship via @repo/ui's
 * globals.css; the consuming app only needs to serve the PNG at that path.
 */
function FlagIcon({ code, name, className, ...props }: FlagIconProps) {
  const cc = code?.trim().toLowerCase()
  if (!cc) return null

  const label = name?.trim() || cc.toUpperCase()

  return (
    <span
      data-slot="flag-icon"
      role="img"
      aria-label={label}
      title={label}
      className={cn("famfamfam-flags", cc, className)}
      {...props}
    />
  )
}

export { FlagIcon }
