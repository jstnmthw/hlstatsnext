import { Button } from "@repo/ui/button"
import Link from "next/link"

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

export function AdminHeader() {
  return (
    <header className="w-full">
      <div className="max-w-screen-lg px-4 md:px-6 lg:px-8 mx-auto py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold">
          {process.env.NEXT_PUBLIC_APP_NAME}{" "}
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="uppercase tracking-tight text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
