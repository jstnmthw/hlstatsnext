import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access"

export const statement = {
  ...defaultStatements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban"],
  dashboard: ["read"],
} as const

export const ac = createAccessControl(statement)

export const adminRole = ac.newRole({
  ...adminAc.statements,
  server: ["create", "read", "update", "delete"],
  game: ["read", "update"],
  player: ["read", "update", "ban"],
  dashboard: ["read"],
})

export const userRole = ac.newRole({
  server: ["read"],
  game: ["read"],
  player: ["read"],
  dashboard: [],
})
