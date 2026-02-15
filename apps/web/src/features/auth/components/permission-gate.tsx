"use client"

import type { ReactNode } from "react"
import { usePermission } from "../hooks/use-permission"

interface PermissionGateProps {
  /** Permission object to check, e.g. { server: ["create"] } */
  permissions: Record<string, string[]>
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Conditionally renders children based on the current user's permissions.
 * Uses Better Auth's synchronous `checkRolePermission()` — no server call.
 */
export function PermissionGate({ permissions, children, fallback = null }: PermissionGateProps) {
  const { hasPermission } = usePermission()

  if (!hasPermission(permissions)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
