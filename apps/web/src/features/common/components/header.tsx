import Link from "next/link"
import { Button, cn } from "@repo/ui"
import { getSession } from "@repo/auth/session"
import { AppLogo } from "@/features/common/components/app-logo"
import { AccountMenu } from "@/features/common/components/account-menu"

const navItems = [
  {
    label: "Servers",
    href: "/servers",
  },
  {
    label: "Games",
    href: "/games",
  },
  {
    label: "Players",
    href: "/players",
  },
]

export async function Header({
  className,
  isFixed = false,
}: {
  className?: string
  isFixed?: boolean
}) {
  const session = await getSession()

  return (
    <header
      className={cn(
        "w-full",
        className,
        isFixed && "fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-background/50",
      )}
    >
      <div className={cn("py-6 flex justify-between items-center container")}>
        <div className="flex items-center gap-2">
          <AppLogo />
        </div>
        <div className="flex items-center gap-8">
          <nav className="flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="uppercase font-semibold text-zinc-400 hover:text-primary-bright transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {session ? (
            <AccountMenu
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
              isAdmin={session.user.role === "admin"}
            />
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
