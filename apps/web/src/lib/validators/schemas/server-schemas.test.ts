import { describe, expect, it } from "vitest"
import { CreateServerSchema, ServerFieldSchemas, UpdateServerSchema } from "./server-schemas"

describe("ServerFieldSchemas", () => {
  describe("serverId", () => {
    it("accepts positive integers", () => {
      expect(ServerFieldSchemas.serverId.parse(1)).toBe(1)
      expect(ServerFieldSchemas.serverId.parse("5")).toBe(5)
    })

    it("rejects zero and negative", () => {
      expect(() => ServerFieldSchemas.serverId.parse(0)).toThrow()
      expect(() => ServerFieldSchemas.serverId.parse(-1)).toThrow()
    })
  })

  describe("port", () => {
    it("accepts valid ports", () => {
      expect(ServerFieldSchemas.port.parse(27015)).toBe(27015)
      expect(ServerFieldSchemas.port.parse("80")).toBe(80)
    })

    it("rejects out-of-range ports", () => {
      expect(() => ServerFieldSchemas.port.parse(0)).toThrow()
      expect(() => ServerFieldSchemas.port.parse(65536)).toThrow()
    })
  })

  describe("name", () => {
    it("accepts optional name", () => {
      expect(ServerFieldSchemas.name.parse("My Server")).toBe("My Server")
      expect(ServerFieldSchemas.name.parse(undefined)).toBeUndefined()
      expect(ServerFieldSchemas.name.parse(null)).toBeNull()
    })

    it("rejects names that are too long", () => {
      expect(() => ServerFieldSchemas.name.parse("a".repeat(256))).toThrow()
    })
  })

  describe("sortOrder", () => {
    it("accepts valid range", () => {
      expect(ServerFieldSchemas.sortOrder.parse(0)).toBe(0)
      expect(ServerFieldSchemas.sortOrder.parse(127)).toBe(127)
    })

    it("rejects out-of-range values", () => {
      expect(() => ServerFieldSchemas.sortOrder.parse(-1)).toThrow()
      expect(() => ServerFieldSchemas.sortOrder.parse(128)).toThrow()
    })

    it("defaults to 0", () => {
      expect(ServerFieldSchemas.sortOrder.parse(undefined)).toBe(0)
    })
  })

  describe("statusUrl", () => {
    it("accepts valid URLs", () => {
      const result = ServerFieldSchemas.statusUrl.parse("https://example.com")
      expect(result).toBe("https://example.com")
    })

    it("accepts empty string and null", () => {
      expect(ServerFieldSchemas.statusUrl.parse("")).toBe("")
      expect(ServerFieldSchemas.statusUrl.parse(null)).toBeNull()
    })

    it("rejects invalid URLs", () => {
      expect(() => ServerFieldSchemas.statusUrl.parse("not-a-url")).toThrow()
    })
  })
})

describe("CreateServerSchema", () => {
  it("validates a valid server", () => {
    const result = CreateServerSchema.safeParse({
      address: "192.168.1.1",
      port: 27015,
      game: "css",
    })
    expect(result.success).toBe(true)
  })

  it("requires port", () => {
    const result = CreateServerSchema.safeParse({
      address: "192.168.1.1",
      game: "css",
    })
    expect(result.success).toBe(false)
  })
})

describe("UpdateServerSchema", () => {
  it("validates a valid update", () => {
    const result = UpdateServerSchema.safeParse({
      serverId: 1,
      address: "192.168.1.1",
      port: 27015,
      game: "css",
    })
    expect(result.success).toBe(true)
  })

  it("requires serverId", () => {
    const result = UpdateServerSchema.safeParse({
      address: "192.168.1.1",
      port: 27015,
      game: "css",
    })
    expect(result.success).toBe(false)
  })
})
