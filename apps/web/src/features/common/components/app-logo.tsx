import Link from "next/link"
import { cn } from "@repo/ui/lib/utils"

export function AppLogo({
  className,
  showVersion = true,
}: {
  className?: string
  showVersion?: boolean
}) {
  return (
    <h1 className={cn(className)}>
      <Link href="/" className="flex items-center gap-2 font-bold">
        {process.env.NEXT_PUBLIC_APP_NAME}{" "}
        {showVersion && <span className="text-xs text-muted-foreground">v1.0.0</span>}
      </Link>
    </h1>
  )
}
