import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const statement = {
  ...defaultStatements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban", "update-own"],
  user: ["list", "update", "set-email", "ban", "set-role", "delete"],
  dashboard: ["read"],
} as const

export const ac = createAccessControl(statement)

export const adminRole = ac.newRole({
  ...adminAc.statements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban", "update-own"],
  user: ["list", "update", "set-email", "ban", "set-role", "delete"],
  dashboard: ["read"],
})

export const userRole = ac.newRole({
  server: ["read"],
  game: ["read"],
  player: ["read", "update-own"],
  user: [],
  dashboard: [],
})

export const roles = { admin: adminRole, user: userRole } as const

export type Role = keyof typeof roles

type Statement = typeof statement
export type Permissions = { [K in keyof Statement]?: Statement[K][number][] }

const defaultRole: Role = "user"

function isRole(value: string): value is Role {
  return Object.hasOwn(roles, value)
}

// Better Auth stores one or more roles as a comma-separated string. Rows written
// before the admin plugin existed have a null role; those and unknown names are
// ordinary users.
function rolesOf(role: string | null | undefined): Role[] {
  const known = (role ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(isRole)
  return known.length > 0 ? known : [defaultRole]
}

export function hasPermission(role: string | null | undefined, permissions: Permissions): boolean {
  return rolesOf(role).some((name) => roles[name].authorize(permissions).success)
}

export function roleOf(user: { role?: string | null } | null | undefined): Role {
  return rolesOf(user?.role).includes("admin") ? "admin" : defaultRole
}

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return roleOf(user) === "admin"
}
