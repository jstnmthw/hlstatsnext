import { Button, cn, ScrollTextIcon, ServerIcon, SettingsIcon, User2Icon, UserIcon } from "@repo/ui"
import Link from "next/link"

const navItems = [
  {
    label: "Players",
    href: "/admin/players",
    active: true,
    icon: <User2Icon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Servers",
    href: "/admin/servers",
    active: false,
    icon: <ServerIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Users",
    href: "/admin/users",
    active: false,
    icon: <UserIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    active: false,
    icon: <SettingsIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
  {
    label: "Logs",
    href: "/admin/logs",
    active: false,
    icon: <ScrollTextIcon className="size-5 text-zinc-500" data-slot="icon" />,
  },
]

export function Navbar() {
  return (
    <nav className="flex items-center justify-between border-b border-t border-border bg-zinc-900/50">
      <ul className="flex items-center gap-6 container py-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <Button
              variant="ghost"
              colorScheme="light"
              asChild
              className={cn(
                item.active &&
                  "after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-0.5 after:bg-primary",
              )}
            >
              <Link href={item.href}>
                {item.icon}
                <span className="text-zinc-100 font-normal">{item.label}</span>
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
