import { Button } from "@repo/ui/button"
import { cn } from "@repo/ui/lib/utils"
import Link from "next/link"

interface HeaderProps {
  fixed?: boolean
}

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
    label: "Login",
    href: "/login",
  },
  {
    label: "Register",
    href: "/register",
    type: "button",
  },
]

export function Header({ fixed = false }: HeaderProps) {
  return (
    <header className={cn("w-full", fixed && "fixed top-0 left-0 right-0 z-50")}>
      <div className="max-w-screen-lg mx-auto py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold">
          {process.env.NEXT_PUBLIC_APP_NAME}{" "}
          <span className="text-xs text-muted-foreground">v1.0.0</span>
        </div>
        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="uppercase tracking-tight text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              {item.type === "button" ? (
                <Button variant="outline" className="cursor-pointer uppercase" size="xs">
                  {item.label}
                </Button>
              ) : (
                item.label
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
