import { SettingsIcon } from "lucide-react"
import { AppLogo } from "@/features/common/components/app-logo"
import Link from "next/link"
import { Badge } from "@repo/ui"

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
  {
    label: "Users",
    href: "/users",
  },
]

export function AdminHeader() {
  return (
    <header className="w-full">
      <div className="container py-6 flex justify-between items-center">
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
