/**
 * Server module type definitions
 *
 * Core types for server management, enrichment, and factory operations.
 */

/**
 * Server record with required fields for creation operations
 */
export interface ServerRecord {
  readonly serverId: number
  readonly city: string | null
  readonly country: string | null
  readonly lat: number | null
  readonly lng: number | null
}

/**
 * Options for GeoIP enrichment
 */
export interface GeoEnrichmentOptions {
  readonly address: string
  readonly port: number
  readonly serverId: number
  readonly currentCity: string | null
  readonly currentCountry: string | null
  readonly currentLat: number | null
  readonly currentLng: number | null
}
