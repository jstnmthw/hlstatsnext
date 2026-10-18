import { describe, expect, it } from "vitest"
import { isActiveNavItem, siteNavItems } from "./nav"

describe("isActiveNavItem", () => {
  it("matches the home link only on the home page", () => {
    expect(isActiveNavItem("/", "/")).toBe(true)
    expect(isActiveNavItem("/servers", "/")).toBe(false)
  })

  it("matches a section on its index and its sub-routes", () => {
    expect(isActiveNavItem("/servers", "/servers")).toBe(true)
    expect(isActiveNavItem("/servers/12", "/servers")).toBe(true)
    expect(isActiveNavItem("/players/7", "/servers")).toBe(false)
  })

  it("does not treat a shared prefix as a sub-route", () => {
    expect(isActiveNavItem("/serverstats", "/servers")).toBe(false)
  })

  it("lists every public section once", () => {
    const hrefs = siteNavItems.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs).toContain("/")
  })
})
