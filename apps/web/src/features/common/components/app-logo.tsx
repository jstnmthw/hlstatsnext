import { APP_VERSION } from "@/lib/app-version"
import { cn, IconSlashes, TextLink } from "@repo/ui"
import Link from "next/link"

export function AppLogo({
  className,
  showVersion = true,
}: {
  className?: string
  showVersion?: boolean
}) {
  return (
    <TextLink
      asChild
      variant="row"
      className={cn("flex items-center gap-2 hover:no-underline", className)}
    >
      <Link href="/">
        <IconSlashes className="size-5 text-primary-bright" />
        <span className="font-bold tracking-tight uppercase">
          {process.env.NEXT_PUBLIC_APP_NAME}
        </span>
        {showVersion && (
          <span className="text-xs font-normal text-muted-foreground">v{APP_VERSION}</span>
        )}
      </Link>
    </TextLink>
  )
}
