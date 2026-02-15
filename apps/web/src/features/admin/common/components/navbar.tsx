"use client"

import Link from "next/link"
import {
  cn,
  Button,
  ScrollTextIcon,
  ServerIcon,
  SettingsIcon,
  User2Icon,
  UserIcon,
  GaugeIcon,
  GamepadIcon,
} from "@repo/ui"
import { usePermission } from "@/features/auth/hooks/use-permission"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  /** If set, the item is only shown when the user's role has this permission. */
  permission?: Record<string, string[]>
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: <GaugeIcon className="size-5" data-slot="icon" />,
  },
  {
    label: "Servers",
    href: "/admin/servers",
    icon: <ServerIcon className="size-5" data-slot="icon" />,
    permission: { server: ["read"] },
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: <User2Icon className="size-5" data-slot="icon" />,
    permission: { player: ["read"] },
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: <UserIcon className="size-5" data-slot="icon" />,
    permission: { user: ["list"] },
  },
  {
    label: "Games",
    href: "/admin/games",
    icon: <GamepadIcon className="size-5" data-slot="icon" />,
    permission: { game: ["read"] },
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
  const { hasPermission } = usePermission()

  const visibleItems = navItems.filter((item) => !item.permission || hasPermission(item.permission))

  return (
    <nav className="flex items-center justify-between border-b border-zinc-700 bg-zinc-950">
      <ul className="flex items-center gap-6 container">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? currentPath === "/admin"
              : currentPath === item.href || currentPath?.startsWith(item.href + "/")
          return (
            <li key={item.href} className="relative py-2">
              {isActive && (
                <span className="absolute inset-0 bg-radial-[at_50%_75%] from-indigo-500 to-transparent from-0% to-75% opacity-20"></span>
              )}
              <Button
                variant="ghost"
                colorScheme="light"
                asChild
                className={cn(
                  "font-semibold tracking-tight text-zinc-500 dark:text-zinc-300 [&>[data-slot=icon]]:text-zinc-500",
                  isActive &&
                    "after:content-[''] text-zinc-500 dark:text-zinc-300 [&>[data-slot=icon]]:text-primary after:absolute after:-bottom-[9px] after:left-0 after:w-full after:h-px after:bg-primary",
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
