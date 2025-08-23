import { SettingsIcon } from "lucide-react"
import { AppLogo } from "@/features/common/components/app-logo"
import Link from "next/link"
import { Badge, cn } from "@repo/ui"

const navItems = [
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
  },
  {
    label: "Servers",
    href: "/admin/servers",
  },
  {
    label: "Games",
    href: "/admin/games",
  },
  {
    label: "Players",
    href: "/admin/players",
  },
  {
    label: "Users",
    href: "/admin/users",
  },
]

export function AdminHeader({
  className,
  isFixed = false,
}: {
  className?: string
  isFixed?: boolean
}) {
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
          <AppLogo showVersion={false} />
          <Badge variant="outline">Admin</Badge>
        </div>
        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="uppercase tracking-tight text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/admin">
            <SettingsIcon className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
