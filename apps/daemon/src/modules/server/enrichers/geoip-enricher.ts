/**
 * GeoIP Enricher
 *
 * Handles best-effort GeoIP location lookup and enrichment for servers.
 */
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { GeoEnrichmentOptions } from "../types/server.types"

import { extractIpFromAddress, ipv4ToBigInt, isIPv4 } from "@/shared/application/utils/ip-utils"

/**
 * GeoIP enrichment service for server location data
 */
export class GeoIpEnricher {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Enriches server with GeoIP location data (best effort, outside transaction)
   */
  async enrichServerWithGeoIP(options: GeoEnrichmentOptions): Promise<void> {
    try {
      const { address, serverId, currentCity, currentCountry, currentLat, currentLng } = options

      const ipOnly = extractIpFromAddress(address)

      // Skip if already has complete geo data or if not IPv4
      if (
        !ipOnly ||
        (currentCity && currentCountry && currentLat != null && currentLng != null) ||
        !isIPv4(ipOnly)
      ) {
        return
      }

      const ipNum = ipv4ToBigInt(ipOnly)
      if (ipNum === null) {
        return
      }

      const location = await this.lookupGeoLocation(ipNum)
      if (!location) {
        return
      }

      await this.updateServerLocation(serverId, location)
    } catch (geoErr) {
      this.logger.warn(
        `Failed to enrich server geo for ${options.address}:${options.port}: ${String(geoErr)}`,
      )
    }
  }

  private async lookupGeoLocation(ipNum: bigint) {
    const block = await this.database.prisma.geoLiteCityBlock.findFirst({
      where: { startIpNum: { lte: ipNum }, endIpNum: { gte: ipNum } },
      select: { locId: true },
    })

    if (!block) {
      return null
    }

    return this.database.prisma.geoLiteCityLocation.findUnique({
      where: { locId: block.locId },
      select: { city: true, country: true, latitude: true, longitude: true },
    })
  }

  private async updateServerLocation(
    serverId: number,
    location: {
      city: string | null
      country: string | null
      latitude: unknown | null
      longitude: unknown | null
    },
  ) {
    await this.database.prisma.server.update({
      where: { serverId },
      data: {
        city: location.city ?? undefined,
        country: location.country ?? undefined,
        lat: location.latitude ? Number(location.latitude) : undefined,
        lng: location.longitude ? Number(location.longitude) : undefined,
      },
    })
  }
}
