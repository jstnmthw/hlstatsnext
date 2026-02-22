/**
 * Token Server Authenticator
 *
 * Authenticates game servers using token-based beacon authentication.
 * Maintains in-memory caches for tokens and source IP → server mappings.
 */

import type { DatabaseClient } from "@/database/client"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { EventType, type ServerAuthenticatedEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { hashToken, isValidTokenFormat } from "@repo/crypto"
import type { ServerTokenEntity, SourceCacheEntry, TokenCacheEntry } from "../entities"
import type { ITokenRepository } from "../repositories"
import { AuthRateLimiter, type RateLimiterConfig } from "../utils/rate-limiter"

/**
 * Result of a beacon authentication attempt.
 */
export type BeaconAuthResult =
  | { kind: "authenticated"; serverId: number }
  | { kind: "auto_registered"; serverId: number; tokenId: number }
  | { kind: "unauthorized"; reason: string }

/**
 * Configuration for TokenServerAuthenticator.
 */
export interface TokenAuthenticatorConfig {
  /** Token cache TTL in ms (default: 60000 = 1 minute) */
  tokenCacheTtlMs: number
  /** Source cache TTL in ms (default: 300000 = 5 minutes) */
  sourceCacheTtlMs: number
  /** Rate limiter config */
  rateLimiter?: Partial<RateLimiterConfig>
}

export const DEFAULT_TOKEN_AUTHENTICATOR_CONFIG: TokenAuthenticatorConfig = {
  tokenCacheTtlMs: 60_000, // 1 minute
  sourceCacheTtlMs: 300_000, // 5 minutes
}

/**
 * Token-based server authenticator.
 *
 * Beacons authenticate servers via tokens; subsequent log lines from the
 * same UDP source are authenticated via the source cache.
 */
export class TokenServerAuthenticator {
  /** Token hash → cached token entity with TTL */
  private readonly tokenCache = new Map<string, TokenCacheEntry>()

  /** "sourceIP:sourcePort" → cached server ID mapping */
  private readonly sourceCache = new Map<string, SourceCacheEntry>()

  /** Rate limiter for failed authentication attempts */
  private readonly rateLimiter: AuthRateLimiter

  /** Rate-limited log messages (messageKey → lastLogTime) */
  private readonly loggedMessages = new Map<string, number>()
  private readonly LOG_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

  private readonly config: TokenAuthenticatorConfig

  constructor(
    private readonly database: DatabaseClient,
    private readonly tokenRepository: ITokenRepository,
    private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
    config?: Partial<TokenAuthenticatorConfig>,
  ) {
    this.config = { ...DEFAULT_TOKEN_AUTHENTICATOR_CONFIG, ...config }
    this.rateLimiter = new AuthRateLimiter(config?.rateLimiter)
  }

  /**
   * Handle an authentication beacon from a game server plugin.
   *
   * @param token - Raw token from the beacon
   * @param gamePort - Game server port (for RCON connection)
   * @param sourceAddress - UDP source IP
   * @param sourcePort - UDP ephemeral source port
   */
  async handleBeacon(
    token: string,
    gamePort: number,
    sourceAddress: string,
    sourcePort: number,
  ): Promise<BeaconAuthResult> {
    // Check rate limiting first
    if (this.rateLimiter.isBlocked(sourceAddress)) {
      this.logger.debug(`Rate-limited beacon from ${sourceAddress}`)
      return { kind: "unauthorized", reason: "rate_limited" }
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      this.rateLimiter.recordFailure(sourceAddress)
      this.logger.warn(`Invalid token format from ${sourceAddress}:${sourcePort}`)
      return { kind: "unauthorized", reason: "invalid_format" }
    }

    // Hash and validate token
    const tokenHash = hashToken(token)
    const validationResult = await this.validateToken(tokenHash)

    if (validationResult.kind !== "valid") {
      const blocked = this.rateLimiter.recordFailure(sourceAddress)
      if (blocked) {
        this.logger.warn(`Source ${sourceAddress} blocked after repeated failures`)
      }
      this.logger.debug(
        `Token validation failed from ${sourceAddress}:${sourcePort}: ${validationResult.kind}`,
      )
      return { kind: "unauthorized", reason: validationResult.kind }
    }

    const tokenEntity = validationResult.token

    // Update lastUsedAt (debounced by repository)
    await this.tokenRepository.updateLastUsed(tokenEntity.id)

    // Find or auto-register server
    const serverResult = await this.findOrRegisterServer(tokenEntity, sourceAddress, gamePort)

    // Cache the source → serverId mapping
    const sourceKey = `${sourceAddress}:${sourcePort}`
    this.sourceCache.set(sourceKey, {
      serverId: serverResult.serverId,
      tokenId: tokenEntity.id,
      cachedAt: Date.now(),
    })

    this.logWithRateLimit(
      `beacon-ok-${sourceKey}`,
      `Beacon authenticated: ${sourceKey} → server ${serverResult.serverId}`,
      "ok",
    )

    // Emit SERVER_AUTHENTICATED for ALL successful authentications (not just auto-registered).
    // This triggers immediate RCON connection — critical after daemon restart when
    // existing servers re-authenticate and need RCON before the monitoring cron fires.
    try {
      const event: ServerAuthenticatedEvent = {
        eventType: EventType.SERVER_AUTHENTICATED,
        timestamp: new Date(),
        serverId: serverResult.serverId,
      }
      await this.eventBus.emit(event)
    } catch (error) {
      this.logger.warn(`Error emitting server authentication event: ${error}`)
    }

    return serverResult
  }

  /**
   * Look up authenticated server by UDP source address.
   * Used for engine-generated log lines (not beacons).
   *
   * @param sourceAddress - UDP source IP
   * @param sourcePort - UDP ephemeral source port
   * @returns Server ID if authenticated, undefined if no session
   */
  lookupSource(sourceAddress: string, sourcePort: number): number | undefined {
    const sourceKey = `${sourceAddress}:${sourcePort}`
    const entry = this.sourceCache.get(sourceKey)

    if (!entry) {
      this.logWithRateLimit(
        `source-unknown-${sourceAddress}`,
        `Unauthenticated log packet from ${sourceKey} — no beacon received. Configure hlx_token on the game server.`,
        "warn",
      )
      return undefined
    }

    // Check TTL
    const age = Date.now() - entry.cachedAt
    if (age > this.config.sourceCacheTtlMs) {
      this.sourceCache.delete(sourceKey)
      this.logger.debug(`Source cache expired for ${sourceKey}`)
      return undefined
    }

    return entry.serverId
  }

  /**
   * Get all currently authenticated server IDs.
   * Used by RCON monitoring to discover active servers.
   */
  getAuthenticatedServerIds(): number[] {
    const now = Date.now()
    const serverIds = new Set<number>()

    for (const [key, entry] of this.sourceCache) {
      const age = now - entry.cachedAt
      if (age <= this.config.sourceCacheTtlMs) {
        serverIds.add(entry.serverId)
      } else {
        // Clean up expired entry
        this.sourceCache.delete(key)
      }
    }

    return Array.from(serverIds)
  }

  /**
   * Clear caches (useful for testing).
   */
  clearCaches(): void {
    this.tokenCache.clear()
    this.sourceCache.clear()
    this.rateLimiter.clear()
    this.loggedMessages.clear()
  }

  /**
   * Validate token via cache or database.
   */
  private async validateToken(
    tokenHash: string,
  ): Promise<
    | { kind: "valid"; token: ServerTokenEntity }
    | { kind: "not_found" }
    | { kind: "revoked" }
    | { kind: "expired" }
  > {
    // Check cache first
    const cached = this.tokenCache.get(tokenHash)
    if (cached) {
      const age = Date.now() - cached.cachedAt
      if (age <= this.config.tokenCacheTtlMs) {
        return { kind: "valid", token: cached.tokenEntity }
      }
      // Cache expired - remove it
      this.tokenCache.delete(tokenHash)
    }

    // Query database via repository
    const result = await this.tokenRepository.findByHash(tokenHash)

    if (result.kind === "valid") {
      // Cache the valid token
      this.tokenCache.set(tokenHash, {
        tokenId: result.token.id,
        tokenEntity: result.token,
        cachedAt: Date.now(),
      })
      return result
    }

    // Map repository result kinds
    if (result.kind === "revoked") {
      return { kind: "revoked" }
    }
    if (result.kind === "expired") {
      return { kind: "expired" }
    }

    return { kind: "not_found" }
  }

  /**
   * Find existing server or auto-register a new one.
   *
   * Server identity is (tokenId + gamePort), NOT (address + gamePort).
   * This survives Docker container restarts where the IP changes but
   * the token and game port remain stable.
   */
  private async findOrRegisterServer(
    token: ServerTokenEntity,
    address: string,
    gamePort: number,
  ): Promise<
    | { kind: "authenticated"; serverId: number }
    | { kind: "auto_registered"; serverId: number; tokenId: number }
  > {
    // Look for existing server with same token + game port (stable identity)
    const existing = await this.database.prisma.server.findFirst({
      where: {
        authTokenId: token.id,
        port: gamePort,
      },
      select: { serverId: true, address: true },
    })

    if (existing) {
      // Update address if it changed (e.g. Docker container restart, IP rotation)
      if (existing.address !== address) {
        await this.database.prisma.server.update({
          where: { serverId: existing.serverId },
          data: { address },
        })
        this.logger.info(
          `Server ${existing.serverId} address updated: ${existing.address} → ${address}`,
        )
      }
      return { kind: "authenticated", serverId: existing.serverId }
    }

    // Auto-register new server and copy default config in a single transaction
    const newServer = await this.database.transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          address,
          port: gamePort,
          name: `${address}:${gamePort}`, // Default name - will be updated by RCON status
          game: token.game,
          rconPassword: token.rconPassword, // Already encrypted
          authTokenId: token.id,
        },
        select: { serverId: true },
      })

      // Copy server_config_default → server_config for this server
      const defaults = await tx.serverConfigDefault.findMany()
      if (defaults.length > 0) {
        await tx.serverConfig.createMany({
          data: defaults.map((d) => ({
            serverId: server.serverId,
            parameter: d.parameter,
            value: d.value,
          })),
          skipDuplicates: true,
        })
        this.logger.debug(
          `Copied ${defaults.length} config defaults for new server ${server.serverId}`,
        )
      }

      return server
    })

    this.logger.ok(
      `Auto-registered new server: ID ${newServer.serverId} at ${address}:${gamePort} (game: ${token.game})`,
    )

    return {
      kind: "auto_registered",
      serverId: newServer.serverId,
      tokenId: token.id,
    }
  }

  /**
   * Log a message with rate limiting to prevent spam.
   * Matches the pattern from the old DatabaseServerAuthenticator.
   */
  private logWithRateLimit(
    messageKey: string,
    message: string,
    level: "info" | "warn" | "debug" | "ok" = "info",
  ): void {
    const now = Date.now()
    const lastLogTime = this.loggedMessages.get(messageKey)

    if (!lastLogTime || now - lastLogTime > this.LOG_COOLDOWN_MS) {
      this.logger[level](message)
      this.loggedMessages.set(messageKey, now)
    }
  }
}
