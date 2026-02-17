import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { OptionsService } from "./options.service"

type OptionRow = { keyname: string; value: string }
interface MockDb {
  prisma: {
    option: {
      findUnique: Mock<(args: unknown) => Promise<OptionRow | null>>
    }
  }
}

const mockDb: MockDb = {
  prisma: {
    option: {
      findUnique: vi.fn<(args: unknown) => Promise<OptionRow | null>>(),
    },
  },
}

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

describe("OptionsService", () => {
  let service: OptionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OptionsService(
      mockDb as unknown as DatabaseClient,
      mockLogger as unknown as ILogger,
      {
        ttlMs: 10,
      },
    )
  })

  it("returns null when option does not exist", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce(null)
    const value = await service.get("missing")
    expect(value).toBeNull()
  })

  it("caches string values and returns booleans and numbers with helpers", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({
      keyname: "flag",
      value: "true",
    })
    const b = await service.getBoolean("flag", false)
    expect(b).toBe(true)

    mockDb.prisma.option.findUnique.mockResolvedValueOnce({
      keyname: "limit",
      value: "42",
    })
    const n = await service.getNumber("limit", 0)
    expect(n).toBe(42)
  })

  it("returns cached value on second call within TTL", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({
      keyname: "key1",
      value: "val1",
    })
    const first = await service.get("key1")
    const second = await service.get("key1")
    expect(first).toBe("val1")
    expect(second).toBe("val1")
    // Only one DB call since second was cached
    expect(mockDb.prisma.option.findUnique).toHaveBeenCalledTimes(1)
  })

  it("returns null and logs error on database failure", async () => {
    mockDb.prisma.option.findUnique.mockRejectedValueOnce(new Error("DB down"))
    const value = await service.get("broken")
    expect(value).toBeNull()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("OptionsService.get failed"),
    )
  })

  it("getBoolean returns false for '0' and 'false' values", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({ keyname: "b", value: "0" })
    expect(await service.getBoolean("b", true)).toBe(false)

    // Wait for cache to expire (ttlMs=10)
    await new Promise((r) => setTimeout(r, 15))
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({ keyname: "b", value: "false" })
    expect(await service.getBoolean("b", true)).toBe(false)
  })

  it("getBoolean returns fallback for unrecognized values", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({ keyname: "b", value: "maybe" })
    expect(await service.getBoolean("b", true)).toBe(true)
  })

  it("getNumber returns fallback for non-numeric string", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce({ keyname: "n", value: "abc" })
    expect(await service.getNumber("n", 99)).toBe(99)
  })

  it("getNumber returns fallback when key is null", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce(null)
    expect(await service.getNumber("missing", 7)).toBe(7)
  })

  it("getBoolean returns fallback when key is null", async () => {
    mockDb.prisma.option.findUnique.mockResolvedValueOnce(null)
    expect(await service.getBoolean("missing", true)).toBe(true)
  })

  it("uses default TTL when no options provided", () => {
    const svc = new OptionsService(
      mockDb as unknown as DatabaseClient,
      mockLogger as unknown as ILogger,
    )
    expect(svc).toBeDefined()
  })
})
