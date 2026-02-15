"use client"

import { authClient, useSession } from "@repo/auth/client"

/**
 * Hook for client-side permission checks using Better Auth's admin plugin.
 * Uses `checkRolePermission()` which is synchronous (no server call).
 */
export function usePermission() {
  const { data: session } = useSession()
  const role = (session?.user.role ?? "user") as "admin" | "user"

  function hasPermission(permissions: Record<string, string[]>): boolean {
    return authClient.admin.checkRolePermission({
      permissions,
      role,
    })
  }

  return { hasPermission, role }
}
