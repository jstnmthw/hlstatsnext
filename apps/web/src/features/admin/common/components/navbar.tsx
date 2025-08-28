import { Button, cn, ScrollTextIcon, ServerIcon, SettingsIcon, User2Icon, UserIcon } from "@repo/ui"
import Link from "next/link"

const navItems = [
  {
    label: "Servers",
    href: "/admin/servers",
    icon: <ServerIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: <User2Icon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: <UserIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Logs",
    href: "/admin/logs",
    icon: <ScrollTextIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: <SettingsIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
]

interface NavbarProps {
  currentPath?: string
}

export function Navbar({ currentPath }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-border">
      <ul className="flex items-center gap-6 container py-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || currentPath?.startsWith(item.href + "/")
          return (
            <li key={item.href}>
              <Button
                variant="ghost"
                colorScheme="light"
                asChild
                className={cn(
                  isActive &&
                    "after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-primary",
                )}
              >
                <Link href={item.href}>
                  {item.icon}
                  <span className="text-zinc-100 font-normal">{item.label}</span>
                </Link>
              </Button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
