/**
 * GeoIP Service
 *
 * Lightweight MaxMind-like lookup using GeoLiteCity tables via Prisma.
 * Converts IPv4 string to numeric and joins with GeoLiteCity tables.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"

export interface GeoIpResult {
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  flag?: string
}

export class GeoIPService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async lookup(ipWithPort: string): Promise<GeoIpResult | null> {
    const [ip] = ipWithPort.split(":")
    if (!ip) return null
    const ipNum = this.ipv4ToNum(ip)
    if (ipNum === null) return null

    try {
      // Find block containing IP
      const block = await this.database.prisma.geoLiteCityBlock.findFirst({
        where: { startIpNum: { lte: BigInt(ipNum) }, endIpNum: { gte: BigInt(ipNum) } },
        select: { locId: true },
      })
      if (!block) return null

      const location = await this.database.prisma.geoLiteCityLocation.findUnique({
        where: { locId: block.locId },
        select: { city: true, country: true, latitude: true, longitude: true },
      })

      if (!location) return null

      const countryCode = location.country
      return {
        city: location.city ?? undefined,
        country: location.country ?? undefined,
        latitude: location.latitude ? Number(location.latitude) : undefined,
        longitude: location.longitude ? Number(location.longitude) : undefined,
        flag: countryCode ?? undefined,
      }
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for ${ipWithPort}: ${String(error)}`)
      return null
    }
  }

  private ipv4ToNum(ip: string): number | null {
    const parts = ip.split(".")
    if (parts.length !== 4) return null
    const nums = parts.map((p) => Number(p)) as [number, number, number, number]
    const [a, b, c, d] = nums
    if ([a, b, c, d].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    return (a << 24) + (b << 16) + (c << 8) + d
  }
}
