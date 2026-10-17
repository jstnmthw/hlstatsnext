import { describe, expect, it } from "vitest"
import { hasPermission, isAdmin, roleOf } from "./permissions"

describe("roleOf", () => {
  it("reads a null or missing role as user", () => {
    expect(roleOf(null)).toBe("user")
    expect(roleOf(undefined)).toBe("user")
    expect(roleOf({ role: null })).toBe("user")
    expect(roleOf({})).toBe("user")
  })

  it("recognizes admin alone or inside a comma-separated list", () => {
    expect(roleOf({ role: "admin" })).toBe("admin")
    expect(roleOf({ role: "user, admin" })).toBe("admin")
  })

  it("treats an unknown role as user", () => {
    expect(roleOf({ role: "superuser" })).toBe("user")
  })
})

describe("isAdmin", () => {
  it("agrees with roleOf", () => {
    expect(isAdmin({ role: "admin" })).toBe(true)
    expect(isAdmin({ role: "user" })).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe("hasPermission", () => {
  it("grants admins the full statement", () => {
    expect(hasPermission("admin", { server: ["create", "delete"] })).toBe(true)
    expect(hasPermission("admin", { user: ["update", "set-email", "ban"] })).toBe(true)
    expect(hasPermission("admin", { dashboard: ["read"] })).toBe(true)
  })

  it("limits users to reads", () => {
    expect(hasPermission("user", { server: ["read"] })).toBe(true)
    expect(hasPermission("user", { server: ["create"] })).toBe(false)
    expect(hasPermission("user", { user: ["list"] })).toBe(false)
    expect(hasPermission("user", { dashboard: ["read"] })).toBe(false)
  })

  it("treats a null or unknown role as user", () => {
    expect(hasPermission(null, { server: ["read"] })).toBe(true)
    expect(hasPermission(null, { server: ["update"] })).toBe(false)
    expect(hasPermission("superuser", { server: ["read"] })).toBe(true)
    expect(hasPermission("superuser", { server: ["update"] })).toBe(false)
  })

  it("passes when any listed role allows it", () => {
    expect(hasPermission("user,admin", { server: ["delete"] })).toBe(true)
  })
})
