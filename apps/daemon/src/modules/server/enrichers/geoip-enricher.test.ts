/**
 * GeoIP Enricher Tests
 *
 * Tests for GeoIP location enrichment service.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { MockDatabaseClient } from "@/tests/mocks/database"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import { Prisma } from "@repo/database/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GeoIpEnricher } from "./geoip-enricher"

describe("GeoIpEnricher", () => {
  let enricher: GeoIpEnricher
  let mockDatabase: MockDatabaseClient & DatabaseClient
  let mockLogger: ILogger

  beforeEach(() => {
    mockDatabase = createMockDatabaseClient()
    mockLogger = createMockLogger()
    enricher = new GeoIpEnricher(mockDatabase, mockLogger)
  })

  describe("enrichServerWithGeoIP", () => {
    it("should skip if server already has complete geo data", async () => {
      const options = {
        address: "192.168.1.1:27015",
        port: 27015,
        serverId: 1,
        currentCity: "New York",
        currentCountry: "US",
        currentLat: 40.7128,
        currentLng: -74.006,
      }

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).not.toHaveBeenCalled()
    })

    it("should skip if address is not valid IPv4", async () => {
      const options = {
        address: "::1",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).not.toHaveBeenCalled()
    })

    it("should skip if IP cannot be extracted", async () => {
      const options = {
        address: "",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).not.toHaveBeenCalled()
    })

    it("should lookup and update server with geo data", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue({
        startIpNum: 100n,
        endIpNum: 200n,
        locId: 123n,
      })

      vi.mocked(mockDatabase.prisma.geoLiteCityLocation.findUnique).mockResolvedValue({
        locId: 123n,
        city: "Mountain View",
        country: "US",
        latitude: new Prisma.Decimal("37.386"),
        longitude: new Prisma.Decimal("-122.084"),
        region: "CA",
        postalCode: "94035",
      })

      vi.mocked(mockDatabase.prisma.server.update).mockResolvedValue({
        serverId: 1,
        city: "Mountain View",
        country: "US",
        lat: 37.386,
        lng: -122.084,
      } as any)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).toHaveBeenCalledWith({
        where: {
          startIpNum: { lte: expect.any(BigInt) },
          endIpNum: { gte: expect.any(BigInt) },
        },
        select: { locId: true },
      })

      expect(mockDatabase.prisma.geoLiteCityLocation.findUnique).toHaveBeenCalledWith({
        where: { locId: 123n },
        select: { city: true, country: true, latitude: true, longitude: true },
      })

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: {
          city: "Mountain View",
          country: "US",
          lat: 37.386,
          lng: -122.084,
        },
      })
    })

    it("should skip update if no geo block found", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue(null)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityLocation.findUnique).not.toHaveBeenCalled()
      expect(mockDatabase.prisma.server.update).not.toHaveBeenCalled()
    })

    it("should skip update if no location found for block", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue({
        startIpNum: 100n,
        endIpNum: 200n,
        locId: 123n,
      })

      vi.mocked(mockDatabase.prisma.geoLiteCityLocation.findUnique).mockResolvedValue(null)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.server.update).not.toHaveBeenCalled()
    })

    it("should handle errors gracefully and log warning", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockRejectedValue(
        new Error("Database error"),
      )

      await enricher.enrichServerWithGeoIP(options)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to enrich server geo"),
      )
    })

    it("should handle null latitude/longitude in location data", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue({
        startIpNum: 100n,
        endIpNum: 200n,
        locId: 123n,
      })

      vi.mocked(mockDatabase.prisma.geoLiteCityLocation.findUnique).mockResolvedValue({
        locId: 123n,
        city: "Unknown",
        country: "XX",
        latitude: null,
        longitude: null,
        region: null,
        postalCode: null,
      })

      vi.mocked(mockDatabase.prisma.server.update).mockResolvedValue({} as any)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: {
          city: "Unknown",
          country: "XX",
          lat: undefined,
          lng: undefined,
        },
      })
    })

    it("should proceed with enrichment if only some geo data is missing", async () => {
      const options = {
        address: "8.8.8.8:27015",
        port: 27015,
        serverId: 1,
        currentCity: "Partial City",
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue({
        startIpNum: 100n,
        endIpNum: 200n,
        locId: 123n,
      })

      vi.mocked(mockDatabase.prisma.geoLiteCityLocation.findUnique).mockResolvedValue({
        locId: 123n,
        city: "New City",
        country: "US",
        latitude: new Prisma.Decimal("40.0"),
        longitude: new Prisma.Decimal("-74.0"),
        region: null,
        postalCode: null,
      })

      vi.mocked(mockDatabase.prisma.server.update).mockResolvedValue({} as any)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).toHaveBeenCalled()
    })

    it("should extract IP from address:port format", async () => {
      const options = {
        address: "192.168.1.100:27015",
        port: 27015,
        serverId: 1,
        currentCity: null,
        currentCountry: null,
        currentLat: null,
        currentLng: null,
      }

      vi.mocked(mockDatabase.prisma.geoLiteCityBlock.findFirst).mockResolvedValue(null)

      await enricher.enrichServerWithGeoIP(options)

      expect(mockDatabase.prisma.geoLiteCityBlock.findFirst).toHaveBeenCalled()
    })
  })
})
