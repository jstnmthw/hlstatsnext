import { cn } from "@repo/ui/lib/utils"
import { tierLabels, tierTextClass, type Tier } from "../lib/tiers"
import { Badge, type BadgeProps } from "./badge"

interface TierBadgeProps extends Omit<BadgeProps, "variant" | "colorScheme"> {
  tier: Tier
}

function TierBadge({ tier, className, children, ...props }: TierBadgeProps) {
  return (
    <Badge
      variant="outline"
      data-slot="tier-badge"
      data-tier={tier}
      className={cn(tierTextClass[tier], className)}
      {...props}
    >
      {children ?? tierLabels[tier]}
    </Badge>
  )
}

export { TierBadge }
export type { TierBadgeProps }
