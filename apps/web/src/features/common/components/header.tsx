import { AccountMenu } from "@/features/common/components/account-menu"
import { AppLogo } from "@/features/common/components/app-logo"
import { SiteNav } from "@/features/common/components/site-nav"
import { isAdmin } from "@repo/auth/permissions"
import { getSession } from "@repo/auth/session"
import { Button, cn, IconSearch, IconUser, TextLink } from "@repo/ui"
import Link from "next/link"

export async function Header({ className }: { className?: string }) {
  const session = await getSession()

  return (
    <header className={cn("w-full border-b", className)}>
      <div className="container flex min-h-14 flex-wrap items-center gap-4">
        <AppLogo />
        <SiteNav />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/players" aria-label="Search players">
              <IconSearch />
            </Link>
          </Button>
          {session ? (
            <AccountMenu
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
              isAdmin={isAdmin(session.user)}
            />
          ) : (
            <TextLink asChild variant="nav">
              <Link href="/login">
                <IconUser />
                Sign in
              </Link>
            </TextLink>
          )}
        </div>
      </div>
    </header>
  )
}
