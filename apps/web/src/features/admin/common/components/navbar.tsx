"use client"

import { usePermission } from "@/features/auth/hooks/use-permission"
import {
  Button,
  cn,
  IconDeviceGamepad2,
  IconFileText,
  IconGauge,
  IconServer,
  IconSettings,
  IconUser,
} from "@repo/ui"
import Link from "next/link"

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
    icon: <IconGauge className="size-5" data-slot="icon" />,
  },
  {
    label: "Servers",
    href: "/admin/servers",
    icon: <IconServer className="size-5" data-slot="icon" />,
    permission: { server: ["read"] },
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: <IconUser className="size-5" data-slot="icon" />,
    permission: { player: ["read"] },
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: <IconUser className="size-5" data-slot="icon" />,
    permission: { user: ["list"] },
  },
  {
    label: "Games",
    href: "/admin/games",
    icon: <IconDeviceGamepad2 className="size-5" data-slot="icon" />,
    permission: { game: ["read"] },
  },
  {
    label: "Logs",
    href: "/admin/logs",
    icon: <IconFileText className="size-5" data-slot="icon" />,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: <IconSettings className="size-5" data-slot="icon" />,
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
      <ul className="container flex items-center gap-6">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? currentPath === "/admin"
              : currentPath === item.href || currentPath?.startsWith(item.href + "/")
          return (
            <li key={item.href} className="relative py-2">
              {isActive && (
                <span className="absolute inset-0 bg-radial-[at_50%_75%] from-green-500 from-0% to-transparent to-75% opacity-20"></span>
              )}
              <Button
                variant="ghost"
                colorScheme="light"
                asChild
                className={cn(
                  "font-semibold tracking-tight text-zinc-500 *:data-[slot=icon]:text-zinc-500 dark:text-zinc-300",
                  isActive &&
                    "text-zinc-500 after:absolute after:-bottom-2.25 after:left-0 after:h-px after:w-full after:bg-primary after:content-[''] *:data-[slot=icon]:text-primary dark:text-zinc-300",
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
