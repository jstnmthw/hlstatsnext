export interface NavItem {
  label: string
  href: string
}

export const siteNavItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Servers", href: "/servers" },
  { label: "Games", href: "/games" },
  { label: "Players", href: "/players" },
]

/** Home only matches itself; every other item also owns its sub-routes. */
export function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
