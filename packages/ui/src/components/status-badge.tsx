import { cn } from "@repo/ui/lib/utils"
import { Badge, type BadgeProps } from "./badge"
import { PulseDot } from "./pulse-dot"

type Status = "online" | "idle" | "offline"

const statusClasses: Record<Status, string> = {
  online: "text-primary-bright",
  idle: "text-muted-foreground",
  offline: "text-destructive",
}

const statusLabels: Record<Status, string> = {
  online: "Online",
  idle: "Idle",
  offline: "Offline",
}

interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "colorScheme"> {
  status: Status
  /** Show the pulsing dot. Defaults to on for `online`. */
  pulse?: boolean
}

function StatusBadge({
  status,
  pulse = status === "online",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      data-slot="status-badge"
      data-status={status}
      className={cn(statusClasses[status], className)}
      {...props}
    >
      {pulse && <PulseDot className="bg-current" />}
      {children ?? statusLabels[status]}
    </Badge>
  )
}

export { StatusBadge }
export type { Status, StatusBadgeProps }
