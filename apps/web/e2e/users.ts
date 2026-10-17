import { fileURLToPath } from "node:url"

export const e2eUsers = {
  admin: {
    name: "E2E Admin",
    email: "e2e-admin@hlstatsnext.test",
    password: "e2e-admin-password-123",
    role: "admin",
  },
  user: {
    name: "E2E User",
    email: "e2e-user@hlstatsnext.test",
    password: "e2e-user-password-123",
    role: "user",
  },
} as const

export type E2EUser = (typeof e2eUsers)[keyof typeof e2eUsers]

export const storageStatePath = {
  admin: fileURLToPath(new URL(".auth/admin.json", import.meta.url)),
  user: fileURLToPath(new URL(".auth/user.json", import.meta.url)),
} as const
