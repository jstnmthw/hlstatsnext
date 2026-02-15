import Link from "next/link"
import { cn, IconFileLambda } from "@repo/ui"

export function AppLogo({
  className,
  showVersion = true,
}: {
  className?: string
  showVersion?: boolean
}) {
  return (
    <h1 className={cn(className)}>
      <Link
        href="/"
        className="flex items-center gap-2 font-bold tracking-tight text-base uppercase"
      >
        <IconFileLambda className="size-5 text-primary-bright" />
        {process.env.NEXT_PUBLIC_APP_NAME}{" "}
        {showVersion && <span className="text-xs text-muted-foreground">v1.0.0</span>}
      </Link>
    </h1>
  )
}
