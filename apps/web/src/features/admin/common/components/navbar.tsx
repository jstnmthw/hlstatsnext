import {
  cn,
  Button,
  ScrollTextIcon,
  ServerIcon,
  SettingsIcon,
  User2Icon,
  UserIcon,
  GaugeIcon,
} from "@repo/ui"
import Link from "next/link"

const navItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: <GaugeIcon className="size-5" data-slot="icon" />,
  },
  {
    label: "Servers",
    href: "/admin/servers",
    icon: <ServerIcon className="size-5" data-slot="icon" />,
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: <User2Icon className="size-5" data-slot="icon" />,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: <UserIcon className="size-5" data-slot="icon" />,
  },
  {
    label: "Logs",
    href: "/admin/logs",
    icon: <ScrollTextIcon className="size-5" data-slot="icon" />,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: <SettingsIcon className="size-5" data-slot="icon" />,
  },
]

interface NavbarProps {
  currentPath?: string
}

export function Navbar({ currentPath }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-border">
      <ul className="flex items-center gap-6 container">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? currentPath === "/admin"
              : currentPath === item.href || currentPath?.startsWith(item.href + "/")
          return (
            <li key={item.href} className="relative py-2">
              {isActive && (
                <span className="absolute inset-0 bg-radial-[at_50%_75%] from-indigo-500  to-zinc-950 from-0% to-75% opacity-20"></span>
              )}
              <Button
                variant="ghost"
                colorScheme="light"
                asChild
                className={cn(
                  "font-medium text-zinc-500 dark:text-zinc-300 [&>[data-slot=icon]]:text-zinc-500",
                  isActive &&
                    "after:content-[''] text-zinc-500 dark:text-zinc-300 [&>[data-slot=icon]]:text-primary after:absolute after:-bottom-[9px] after:left-0 after:w-full after:h-0.5 after:bg-primary",
                )}
              >
                <Link href={item.href}>
                  {item.icon}
                  {item.label}
                </Link>
              </Button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
