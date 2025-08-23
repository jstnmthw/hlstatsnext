import { AppLogo } from "@/features/common/components/app-logo"
import { Button, cn } from "@repo/ui"
import Link from "next/link"

interface HeaderProps {
  fixed?: boolean
}

const navItems = [
  {
    label: "Admin",
    href: "/admin",
  },
  {
    label: "UI Kit",
    href: "/admin/ui-kit",
  },
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
    label: "Sign Up",
    href: "/signup",
    type: "button",
  },
]

export function Header({ fixed = false }: HeaderProps) {
  return (
    <header className={cn("w-full", fixed && "fixed top-0 left-0 right-0 z-50")}>
      <div className="container py-6 flex justify-between items-center">
        <AppLogo />
        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="uppercase tracking-tight text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              {item.type === "button" ? (
                <Button variant="outline" className="cursor-pointer uppercase" size="sm">
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
