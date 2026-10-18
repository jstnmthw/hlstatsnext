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
import {
  AuthRateLimiter,
  DEFAULT_RATE_LIMITER_CONFIG,
  type RateLimiterConfig,
} from "../utils/rate-limiter"

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
  /** Rate limiter for failures from one UDP endpoint (ip:port) */
  rateLimiter?: Partial<RateLimiterConfig>
  /**
   * Rate limiter for failures from one IP across all ports. A game host runs
   * many servers behind one address, so this ceiling must sit well above the
   * per-endpoint one or a token rotation on a large fleet blocks the servers
   * that were already migrated.
   */
  perAddressRateLimiter?: Partial<RateLimiterConfig>
}

export const DEFAULT_TOKEN_AUTHENTICATOR_CONFIG: TokenAuthenticatorConfig = {
  tokenCacheTtlMs: 60_000, // 1 minute
  sourceCacheTtlMs: 300_000, // 5 minutes
}

export const DEFAULT_PER_ADDRESS_RATE_LIMITER_CONFIG: Partial<RateLimiterConfig> = {
  maxAttempts: DEFAULT_RATE_LIMITER_CONFIG.maxAttempts * 10,
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

  /** Failed attempts per UDP endpoint (ip:port) */
  private readonly endpointRateLimiter: AuthRateLimiter

  /** Failed attempts per source IP across all ports (flood guard) */
  private readonly addressRateLimiter: AuthRateLimiter

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
    this.endpointRateLimiter = new AuthRateLimiter(config?.rateLimiter)
    this.addressRateLimiter = new AuthRateLimiter({
      ...DEFAULT_PER_ADDRESS_RATE_LIMITER_CONFIG,
      ...config?.perAddressRateLimiter,
    })
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
    const sourceKey = `${sourceAddress}:${sourcePort}`

    // Check rate limiting first
    if (this.isRateLimited(sourceAddress, sourceKey)) {
      this.logger.debug(`Rate-limited beacon from ${sourceKey}`)
      return { kind: "unauthorized", reason: "rate_limited" }
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      this.recordFailure(sourceAddress, sourceKey)
      this.logger.warn(`Invalid token format from ${sourceKey}`)
      return { kind: "unauthorized", reason: "invalid_format" }
    }

    // A DB outage during validateToken throws — wrap it so the rate limiter
    // still counts the failed attempt. Otherwise an attacker can probe with
    // the same source IP forever while the DB is unreachable without ever
    // being blocked.
    const tokenHash = hashToken(token)
    let validationResult
    try {
      validationResult = await this.validateToken(tokenHash)
    } catch (error) {
      this.recordFailure(sourceAddress, sourceKey)
      this.logger.warn(
        `Token validation error from ${sourceKey}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return { kind: "unauthorized", reason: "validation_error" }
    }

    if (validationResult.kind !== "valid") {
      this.recordFailure(sourceAddress, sourceKey)
      this.logger.debug(`Token validation failed from ${sourceKey}: ${validationResult.kind}`)
      return { kind: "unauthorized", reason: validationResult.kind }
    }

    const tokenEntity = validationResult.token

    // Update lastUsedAt (debounced by repository)
    await this.tokenRepository.updateLastUsed(tokenEntity.id)

    // Find or auto-register server
    const serverResult = await this.findOrRegisterServer(tokenEntity, sourceAddress, gamePort)

    // Cache the source → serverId mapping
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
    //
    // Fire-and-forget rather than awaiting. A slow SERVER_AUTHENTICATED
    // subscriber (RCON connect can take seconds) must not block beacon
    // handling for this source. Errors are still logged.
    const event: ServerAuthenticatedEvent = {
      eventType: EventType.SERVER_AUTHENTICATED,
      timestamp: new Date(),
      serverId: serverResult.serverId,
    }
    void this.eventBus.emit(event).catch((error) => {
      this.logger.warn(`Error emitting server authentication event: ${error}`)
    })

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
        `source-unknown-${sourceKey}`,
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
    this.endpointRateLimiter.clear()
    this.addressRateLimiter.clear()
    this.loggedMessages.clear()
  }

  /**
   * Periodic sweep. Drops expired token/source cache entries, prunes the
   * log-cooldown map for messages outside the cooldown window, and delegates
   * to the rate limiter. Bounded by unique source IPs over the daemon's
   * lifetime; unbounded in practice without this sweep.
   */
  sweep(): {
    tokens: number
    sources: number
    logMessages: number
    rateLimitEntries: number
  } {
    const now = Date.now()
    let tokens = 0
    let sources = 0
    let logMessages = 0

    for (const [hash, entry] of this.tokenCache) {
      if (now - entry.cachedAt > this.config.tokenCacheTtlMs) {
        this.tokenCache.delete(hash)
        tokens++
      }
    }

    for (const [key, entry] of this.sourceCache) {
      if (now - entry.cachedAt > this.config.sourceCacheTtlMs) {
        this.sourceCache.delete(key)
        sources++
      }
    }

    // Anything older than 2× the cooldown can't suppress a future log line.
    const logCutoff = now - this.LOG_COOLDOWN_MS * 2
    for (const [key, lastLogTime] of this.loggedMessages) {
      if (lastLogTime < logCutoff) {
        this.loggedMessages.delete(key)
        logMessages++
      }
    }

    const rateLimitEntries = this.endpointRateLimiter.sweep() + this.addressRateLimiter.sweep()

    return { tokens, sources, logMessages, rateLimitEntries }
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
    const displayHost = token.rconAddress || address

    // Atomic upsert using the @@unique([authTokenId, port]) constraint —
    // prevents duplicate servers when concurrent beacons arrive before either
    // commits.
    const server = await this.database.prisma.server.upsert({
      where: {
        servers_token_port_unique: {
          authTokenId: token.id,
          port: gamePort,
        },
      },
      // Do not overwrite address on re-beacon: the learned UDP source IP can be a
      // NAT artifact (e.g. a Docker bridge gateway) and would clobber an
      // operator-meaningful value. address is best-effort set once at create;
      // RCON dialing uses rconAddress when set (see RconRepository), which is
      // seeded from the token's default host so a NAT'd learned address never
      // needs a manual fix after onboarding.
      update: {},
      create: {
        address,
        port: gamePort,
        name: `${displayHost}:${gamePort}`,
        game: token.game,
        rconPassword: token.rconPassword,
        rconAddress: token.rconAddress,
        publicAddress: token.rconAddress,
        authTokenId: token.id,
      },
      select: { serverId: true },
    })

    // Check if this is a new server that needs default config copied
    const configCount = await this.database.prisma.serverConfig.count({
      where: { serverId: server.serverId },
    })

    if (configCount === 0) {
      // New server — copy defaults in a transaction
      const defaults = await this.database.prisma.serverConfigDefault.findMany()
      if (defaults.length > 0) {
        await this.database.prisma.serverConfig.createMany({
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

      this.logger.ok(
        `Auto-registered new server: ID ${server.serverId} at ${address}:${gamePort} (game: ${token.game}${token.rconAddress ? `, rcon host: ${token.rconAddress}` : ""})`,
      )

      return {
        kind: "auto_registered",
        serverId: server.serverId,
        tokenId: token.id,
      }
    }

    return { kind: "authenticated", serverId: server.serverId }
  }

  private isRateLimited(sourceAddress: string, sourceKey: string): boolean {
    return (
      this.endpointRateLimiter.isBlocked(sourceKey) ||
      this.addressRateLimiter.isBlocked(sourceAddress)
    )
  }

  /**
   * Count a failure against both limiters. One misbehaving server trips its
   * endpoint limiter; only a flood from many ports trips the address limiter.
   */
  private recordFailure(sourceAddress: string, sourceKey: string): void {
    if (this.endpointRateLimiter.recordFailure(sourceKey)) {
      this.logger.warn(`Source ${sourceKey} blocked after repeated failures`)
    }
    if (this.addressRateLimiter.recordFailure(sourceAddress)) {
      this.logger.warn(`Address ${sourceAddress} blocked after repeated failures across ports`)
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
