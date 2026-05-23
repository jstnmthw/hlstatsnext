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

/**
 * Bounded LRU cache for GeoIP lookups. Without it, every connect event
 * triggers two sequential Prisma queries on the hot path — and a server
 * reboot (30+ simultaneous reconnects) stampedes the DB.
 */
class LruCache<K, V> {
  private readonly map = new Map<K, V>()
  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined
    const value = this.map.get(key) as V
    // Re-insert to mark as most-recently-used.
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }
}

export class GeoIPService {
  /**
   * Cache keyed by numeric IP (not "ip:port") so different ephemeral ports
   * from the same host share a result. 10k entries × small payload keeps the
   * footprint bounded; eviction is LRU on overflow.
   */
  private readonly cache = new LruCache<number, GeoIpResult | null>(10_000)

  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async lookup(ipWithPort: string): Promise<GeoIpResult | null> {
    const [ip] = ipWithPort.split(":")
    if (!ip) return null
    const ipNum = this.ipv4ToNum(ip)
    if (ipNum === null) return null

    const cached = this.cache.get(ipNum)
    if (cached !== undefined) return cached

    try {
      // Find block containing IP
      const block = await this.database.prisma.geoLiteCityBlock.findFirst({
        where: { startIpNum: { lte: BigInt(ipNum) }, endIpNum: { gte: BigInt(ipNum) } },
        select: { locId: true },
      })
      if (!block) {
        // Cache the negative result too — repeated misses are the common case
        // for private/unknown addresses and they hit the DB just as hard.
        this.cache.set(ipNum, null)
        return null
      }

      const location = await this.database.prisma.geoLiteCityLocation.findUnique({
        where: { locId: block.locId },
        select: { city: true, country: true, latitude: true, longitude: true },
      })

      if (!location) {
        this.cache.set(ipNum, null)
        return null
      }

      const countryCode = location.country
      const result: GeoIpResult = {
        city: location.city ?? undefined,
        country: location.country ?? undefined,
        latitude: location.latitude ? Number(location.latitude) : undefined,
        longitude: location.longitude ? Number(location.longitude) : undefined,
        flag: countryCode ?? undefined,
      }
      this.cache.set(ipNum, result)
      return result
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for ${ipWithPort}: ${String(error)}`)
      // Don't cache errors — the DB might recover and we want a fresh attempt.
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
