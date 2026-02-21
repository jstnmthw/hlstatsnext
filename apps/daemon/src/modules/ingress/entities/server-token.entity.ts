/**
 * Server Token Domain Types
 *
 * Domain entities and result types for server token authentication.
 * These types are independent of the database layer (Prisma).
 */

/**
 * Server authentication token entity.
 * Represents a token that can authenticate multiple game servers.
 */
export interface ServerTokenEntity {
  readonly id: number
  readonly tokenHash: string
  readonly tokenPrefix: string
  readonly name: string
  /** AES-256-GCM encrypted RCON password */
  readonly rconPassword: string
  /** Game type code (e.g., "cstrike", "valve", "tf") */
  readonly game: string
  readonly createdAt: Date
  readonly expiresAt: Date | null
  readonly revokedAt: Date | null
  readonly lastUsedAt: Date | null
  /** User ID who created this token */
  readonly createdBy: string
}

/**
 * Result of validating a token against the database.
 * Discriminated union for explicit handling of all cases.
 */
export type TokenValidationResult =
  | { kind: "valid"; token: ServerTokenEntity }
  | { kind: "revoked"; tokenPrefix: string }
  | { kind: "expired"; tokenPrefix: string }
  | { kind: "not_found" }

/**
 * Result of authenticating a server via beacon or source cache.
 */
export type AuthenticationResult =
  | { kind: "authenticated"; serverId: number }
  | { kind: "auto_registered"; serverId: number; tokenId: number }
  | { kind: "unauthorized"; reason: UnauthorizedReason }

/**
 * Reasons for authentication failure.
 */
export type UnauthorizedReason =
  | "no_session" // Engine log line, no source cache entry
  | "token_not_found"
  | "token_revoked"
  | "token_expired"
  | "rate_limited"
  | "invalid_format"

/**
 * Token cache entry with TTL tracking.
 * Used by TokenServerAuthenticator for in-memory caching.
 */
export interface TokenCacheEntry {
  readonly tokenId: number
  readonly tokenEntity: ServerTokenEntity
  /** Timestamp when this entry was cached (Date.now()) */
  readonly cachedAt: number
}

/**
 * Source cache entry mapping UDP source to authenticated server.
 * Key: "sourceIP:sourcePort" (ephemeral port from UDP packet)
 */
export interface SourceCacheEntry {
  readonly serverId: number
  readonly tokenId: number
  /** Timestamp when this entry was cached (Date.now()) */
  readonly cachedAt: number
}
