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
})
