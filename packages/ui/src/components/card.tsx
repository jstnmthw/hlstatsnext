import { cn } from "../lib/utils"

export function Card({
  children,
  className,
  hoverable = false,
  ...props
}: {
  children: React.ReactNode
  className?: string
  hoverable?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(className, "rounded-lg border border-border", hoverable && "hover:bg-muted")}
      {...props}
    >
      {children}
    </div>
  )
}
