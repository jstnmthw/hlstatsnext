"use client"

import { isActiveNavItem, siteNavItems } from "@/features/common/lib/nav"
import { TextLink } from "@repo/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="flex flex-wrap gap-1">
      {siteNavItems.map((item) => (
        <TextLink
          key={item.href}
          asChild
          variant="nav"
          aria-current={isActiveNavItem(pathname, item.href) ? "page" : undefined}
        >
          <Link href={item.href}>{item.label}</Link>
        </TextLink>
      ))}
    </nav>
  )
}
