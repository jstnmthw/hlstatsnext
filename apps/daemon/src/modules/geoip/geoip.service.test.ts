import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import type { DatabaseClient } from "@/database/client"
import { createMockLogger } from "@/tests/mocks/logger"
import { GeoIPService } from "./geoip.service"

type BlockRow = { locId: bigint }
type LocationRow = {
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface MockDb {
  prisma: {
    geoLiteCityBlock: { findFirst: Mock<(args: unknown) => Promise<BlockRow | null>> }
    geoLiteCityLocation: {
      findUnique: Mock<(args: unknown) => Promise<LocationRow | null>>
    }
  }
}

const mockDb: MockDb = {
  prisma: {
    geoLiteCityBlock: {
      findFirst: vi.fn<(args: unknown) => Promise<BlockRow | null>>(),
    },
    geoLiteCityLocation: {
      findUnique: vi.fn<(args: unknown) => Promise<LocationRow | null>>(),
    },
  },
}

const mockLogger = createMockLogger()

describe("GeoIPService", () => {
  let service: GeoIPService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GeoIPService(
      mockDb as unknown as DatabaseClient,
      mockLogger,
    )
  })

  it("returns null for invalid IPs", async () => {
    const r = await service.lookup("not-an-ip")
    expect(r).toBeNull()
  })

  it("resolves geo for IPv4", async () => {
    mockDb.prisma.geoLiteCityBlock.findFirst.mockResolvedValueOnce({ locId: BigInt(1) })
    mockDb.prisma.geoLiteCityLocation.findUnique.mockResolvedValueOnce({
      city: "Seattle",
      country: "US",
      latitude: 47.6062,
      longitude: -122.3321,
    })

    const r = await service.lookup("1.2.3.4:27015")
    expect(r?.city).toBe("Seattle")
    expect(r?.country).toBe("US")
    expect(r?.flag).toBe("US")
  })
})
