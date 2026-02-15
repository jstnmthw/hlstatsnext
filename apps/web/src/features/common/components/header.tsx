import { IconSettings } from "@repo/ui"
import { AppLogo } from "@/features/common/components/app-logo"
import Link from "next/link"
import { cn } from "@repo/ui"

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

export function Header({ className, isFixed = false }: { className?: string; isFixed?: boolean }) {
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
            <IconSettings className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
