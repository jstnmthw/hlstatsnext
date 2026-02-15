import { AppLogo } from "@/features/common/components/app-logo"
import { Badge, Button, cn, IconBrush, IconSettings } from "@repo/ui"
import Link from "next/link"
import { Navbar } from "./navbar"
import { UserMenu } from "./user-menu"

const navItems = [
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
    icon: <IconBrush className="size-4" aria-label="UI Kit" aria-hidden="true" data-slot="icon" />,
    iconOnly: true,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: (
      <IconSettings className="size-4" aria-label="Settings" aria-hidden="true" data-slot="icon" />
    ),
    iconOnly: true,
  },
]

interface AdminHeaderProps {
  className?: string
  currentPath?: string
}

export function AdminHeader({ className, currentPath }: AdminHeaderProps) {
  return (
    <>
      <header className={cn("w-full bg-zinc-950", className)}>
        <div className={cn("container flex items-center justify-between py-6")}>
          <div className="flex items-center gap-2">
            <AppLogo showVersion={false} />
            <Badge variant="outline" colorScheme="indigo">
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Button key={item.href} variant="outline" colorScheme="zinc" size="icon-sm" asChild>
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
            <UserMenu />
          </div>
        </div>
      </header>
      <Navbar currentPath={currentPath} />
    </>
  )
}
