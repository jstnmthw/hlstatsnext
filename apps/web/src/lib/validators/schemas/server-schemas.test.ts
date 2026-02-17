import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  connectionTypeRefine,
  CreateServerSchema,
  ServerFieldSchemas,
  UpdateServerSchema,
} from "./server-schemas"

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

  describe("connectionType", () => {
    it("accepts valid types", () => {
      expect(ServerFieldSchemas.connectionType.parse("external")).toBe("external")
      expect(ServerFieldSchemas.connectionType.parse("docker")).toBe("docker")
    })

    it("defaults to external", () => {
      expect(ServerFieldSchemas.connectionType.parse(undefined)).toBe("external")
    })

    it("rejects invalid types", () => {
      expect(() => ServerFieldSchemas.connectionType.parse("invalid")).toThrow()
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

describe("connectionTypeRefine", () => {
  it("requires docker_host for docker type", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine({ connection_type: "docker", docker_host: "", address: "1.2.3.4" }, ctx)
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ path: ["docker_host"] }),
    )
  })

  it("requires address for external type", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine({ connection_type: "external", address: "", docker_host: "host" }, ctx)
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ path: ["address"] }),
    )
  })

  it("does not add issues for valid docker config", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine(
      { connection_type: "docker", docker_host: "my-container", address: null },
      ctx,
    )
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("does not add issues for valid external config", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine(
      { connection_type: "external", address: "192.168.1.1", docker_host: null },
      ctx,
    )
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it("handles null docker_host for docker type", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine({ connection_type: "docker", docker_host: null, address: null }, ctx)
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  it("handles null address for external type", () => {
    const ctx = { addIssue: vi.fn() } as unknown as z.RefinementCtx
    connectionTypeRefine({ connection_type: "external", address: null, docker_host: null }, ctx)
    expect(ctx.addIssue as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })
})

describe("CreateServerSchema", () => {
  it("validates a valid external server", () => {
    const result = CreateServerSchema.safeParse({
      address: "192.168.1.1",
      port: 27015,
      game: "css",
      connection_type: "external",
    })
    expect(result.success).toBe(true)
  })

  it("validates a valid docker server", () => {
    const result = CreateServerSchema.safeParse({
      docker_host: "game-server",
      port: 27015,
      game: "css",
      connection_type: "docker",
    })
    expect(result.success).toBe(true)
  })

  it("fails when docker type has no docker_host", () => {
    const result = CreateServerSchema.safeParse({
      port: 27015,
      game: "css",
      connection_type: "docker",
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
      connection_type: "external",
    })
    expect(result.success).toBe(true)
  })

  it("requires serverId", () => {
    const result = UpdateServerSchema.safeParse({
      address: "192.168.1.1",
      port: 27015,
      game: "css",
      connection_type: "external",
    })
    expect(result.success).toBe(false)
  })
})
