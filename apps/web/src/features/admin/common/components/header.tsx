import { AccountMenu } from "@/features/common/components/account-menu"
import { AppLogo } from "@/features/common/components/app-logo"
import { getSession } from "@repo/auth"
import { Badge, Button, cn, IconBrush } from "@repo/ui"
import Link from "next/link"
import { Navbar } from "./navbar"

const navItems = [
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
    icon: <IconBrush className="size-4" aria-label="UI Kit" aria-hidden="true" data-slot="icon" />,
    iconOnly: true,
  },
]

interface AdminHeaderProps {
  className?: string
  currentPath?: string
}

export async function AdminHeader({ className, currentPath }: AdminHeaderProps) {
  const session = await getSession()

  return (
    <>
      <header className={cn("w-full", className)}>
        <div className={cn("container flex items-center justify-between py-6")}>
          <div className="flex items-center gap-2">
            <AppLogo showVersion={true} />
            <Badge variant="primary">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Button key={item.href} variant="ghost" colorScheme="zinc" size="icon-sm" asChild>
                  <Link href={item.href} aria-label={item.label}>
                    {item.iconOnly ? (
                      item.icon
                    ) : (
                      <>
                        {item.icon}
                        {item.label}
                      </>
                    )}
                  </Link>
                </Button>
              ))}
            </nav>
            {session && (
              <AccountMenu
                user={{
                  name: session.user.name,
                  email: session.user.email,
                  image: session.user.image,
                }}
                isAdmin={session.user.role === "admin"}
              />
            )}
          </div>
        </div>
      </header>
      <Navbar currentPath={currentPath} />
    </>
  )
}
