import type { DatabaseClient } from "@/database/client"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
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
    service = new GeoIPService(mockDb as unknown as DatabaseClient, mockLogger)
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

  it("returns null when block is not found", async () => {
    mockDb.prisma.geoLiteCityBlock.findFirst.mockResolvedValueOnce(null)
    const r = await service.lookup("1.2.3.4:27015")
    expect(r).toBeNull()
  })

  it("returns null when location is not found", async () => {
    mockDb.prisma.geoLiteCityBlock.findFirst.mockResolvedValueOnce({ locId: BigInt(99) })
    mockDb.prisma.geoLiteCityLocation.findUnique.mockResolvedValueOnce(null)
    const r = await service.lookup("1.2.3.4:27015")
    expect(r).toBeNull()
  })

  it("returns null and logs warning on database error", async () => {
    mockDb.prisma.geoLiteCityBlock.findFirst.mockRejectedValueOnce(new Error("DB error"))
    const r = await service.lookup("1.2.3.4:27015")
    expect(r).toBeNull()
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("GeoIP lookup failed"))
  })

  it("returns null for empty IP string", async () => {
    const r = await service.lookup("")
    expect(r).toBeNull()
  })

  it("returns null for IP with out-of-range octets", async () => {
    const r = await service.lookup("999.0.0.1:27015")
    expect(r).toBeNull()
  })

  it("handles null city/country/lat/lng fields", async () => {
    mockDb.prisma.geoLiteCityBlock.findFirst.mockResolvedValueOnce({ locId: BigInt(2) })
    mockDb.prisma.geoLiteCityLocation.findUnique.mockResolvedValueOnce({
      city: null,
      country: null,
      latitude: null,
      longitude: null,
    })
    const r = await service.lookup("10.0.0.1:27015")
    expect(r).toBeDefined()
    expect(r?.city).toBeUndefined()
    expect(r?.country).toBeUndefined()
    expect(r?.latitude).toBeUndefined()
    expect(r?.longitude).toBeUndefined()
    expect(r?.flag).toBeUndefined()
  })

  it("returns null for IP without port", async () => {
    const r = await service.lookup("abc")
    expect(r).toBeNull()
  })
})
