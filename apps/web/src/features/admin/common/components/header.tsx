import Link from "next/link"
import { Badge, cn } from "@repo/ui"
import { SettingsIcon } from "lucide-react"
import { AppLogo } from "@/features/common/components/app-logo"
import { Navbar } from "./navbar"

const navItems = [
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
  },
]

export function AdminHeader({ className }: { className?: string }) {
  return (
    <>
      <header className={cn("w-full", className)}>
        <div className={cn("py-6 flex justify-between items-center container")}>
          <div className="flex items-center gap-2">
            <AppLogo showVersion={false} />
            <Badge variant="outline" colorScheme="indigo">
              Admin
            </Badge>
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
            <Link href="/admin" className="text-zinc-400 hover:text-white transition-colors">
              <SettingsIcon className="size-4" />
            </Link>
          </nav>
        </div>
      </header>
      <Navbar />
    </>
  )
}
