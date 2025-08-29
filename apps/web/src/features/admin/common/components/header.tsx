import Link from "next/link"
import { Badge, Button, cn } from "@repo/ui"
import { PaintbrushIcon, SettingsIcon } from "lucide-react"
import { AppLogo } from "@/features/common/components/app-logo"
import { Navbar } from "./navbar"

const navItems = [
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
    icon: (
      <PaintbrushIcon className="size-4" aria-label="UI Kit" aria-hidden="true" data-slot="icon" />
    ),
    iconOnly: true,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: (
      <SettingsIcon className="size-4" aria-label="Settings" aria-hidden="true" data-slot="icon" />
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
        <div className={cn("py-6 flex justify-between items-center container")}>
          <div className="flex items-center gap-2">
            <AppLogo showVersion={false} />
            <Badge variant="outline" colorScheme="indigo">
              Admin
            </Badge>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Button key={item.href} variant="outline" colorScheme="zinc" size="icon-sm" asChild>
                <Link key={item.href} href={item.href} aria-label={item.label}>
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
        </div>
      </header>
      <Navbar currentPath={currentPath} />
    </>
  )
}
