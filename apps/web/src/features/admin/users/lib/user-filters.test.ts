import { describe, expect, it } from "vitest"
import { statusFilterTransform } from "./user-filters"

describe("statusFilterTransform", () => {
  it("returns undefined for empty values", () => {
    expect(statusFilterTransform([])).toBeUndefined()
  })

  it("returns single clause for one status", () => {
    const result = statusFilterTransform(["active"])
    expect(result).toEqual({
      banned: { not: { equals: true } },
      emailVerified: { equals: true },
    })
  })

  it("returns banned clause", () => {
    const result = statusFilterTransform(["banned"])
    expect(result).toEqual({
      banned: { equals: true },
    })
  })

  it("returns unverified clause", () => {
    const result = statusFilterTransform(["unverified"])
    expect(result).toEqual({
      emailVerified: { equals: false },
      banned: { not: { equals: true } },
    })
  })

  it("returns OR clause for multiple statuses", () => {
    const result = statusFilterTransform(["active", "banned"])
    expect(result).toEqual({
      OR: [
        { banned: { not: { equals: true } }, emailVerified: { equals: true } },
        { banned: { equals: true } },
      ],
    })
  })

  it("ignores unknown status values", () => {
    expect(statusFilterTransform(["unknown"])).toBeUndefined()
  })

  it("handles mix of known and unknown values", () => {
    const result = statusFilterTransform(["active", "unknown"])
    expect(result).toEqual({
      banned: { not: { equals: true } },
      emailVerified: { equals: true },
    })
  })
})
