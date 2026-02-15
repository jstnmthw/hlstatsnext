/**
 * Database Server Authenticator
 *
 * Handles server authentication logic using database lookups and caching.
 */
import type { DatabaseClient } from "@/database/client"
import { validateAddress } from "@/shared/application/validators/address-validator"
import { validatePort } from "@/shared/application/validators/port-validator"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { EventType, type ServerAuthenticatedEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IServerAuthenticator } from "../ingress.dependencies"
import type { AuthenticationResult } from "../types/ingress.types"

/**
 * Server authenticator implementation using database
 */
export class DatabaseServerAuthenticator implements IServerAuthenticator {
  private readonly authenticatedServers = new Map<string, number>()
  private readonly loggedMessages = new Map<string, number>() // Track all rate-limited log messages
  private readonly LOG_COOLDOWN = 5 * 60 * 1000 // 5 minutes in milliseconds

  constructor(
    private readonly database: DatabaseClient,
    private readonly logger: ILogger,
    private readonly eventBus: IEventBus,
  ) {}

  async authenticateServer(address: string, port: number): Promise<number | null> {
    try {
      validateAddress(address)
      validatePort(port)
    } catch (error) {
      this.logger.warn(`Invalid server credentials: ${error}`)
      return null
    }

    const result = await this.authenticateServerInternal(address, port)
    return this.mapAuthenticationResult(result)
  }

  /**
   * Check if an IP address is from a Docker network
   * Docker typically uses 172.17.0.0/16, 172.18.0.0/16, etc. or custom bridges
   */
  private isDockerNetwork(address: string): boolean {
    try {
      const parts = address.split(".")
      if (parts.length !== 4) return false

      const firstOctet = parseInt(parts[0] || "0", 10)
      const secondOctet = parseInt(parts[1] || "0", 10)

      // Check common Docker network ranges
      // 172.16.0.0 - 172.31.255.255 (Docker default bridge networks)
      // 10.0.0.0 - 10.255.255.255 (Custom Docker networks)
      return (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) || firstOctet === 10
    } catch {
      return false
    }
  }

  /**
   * Match Docker server based on IP address patterns
   */
  private async matchDockerServer(
    address: string,
    port: number,
  ): Promise<{ serverId: number; dockerHost?: string | null; name: string; game: string } | null> {
    const dockerServers = await this.database.prisma.server.findMany({
      where: {
        connectionType: "docker",
      },
      select: {
        serverId: true,
        dockerHost: true,
        name: true,
        game: true,
      },
    })

    if (dockerServers.length === 0) {
      return null
    }

    // Strategy 1: For container IPs (172.18.0.2, 172.18.0.3, etc.), match the actual container
    // Real Docker containers typically have IPs ending in .2, .3, .4, etc.
    const parts = address.split(".")
    if (parts.length === 4) {
      const lastOctet = parseInt(parts[3] || "0", 10)

      // If it's a container IP (not gateway), try to match by container order
      if (lastOctet >= 2) {
        // Match by container creation order (first container gets .2, second gets .3, etc.)
        const containerIndex = lastOctet - 2
        if (containerIndex < dockerServers.length) {
          const server = dockerServers[containerIndex]
          if (server) {
            this.logWithRateLimit(
              `docker-container-match-${address}`,
              `Matched Docker container IP ${address} to server ${server.serverId} (${server.name}) based on container index`,
              "info",
            )
            return server
          }
        }
      }

      // If it's the Docker gateway IP (172.18.0.1), it's likely an external server routed through Docker
      // We should reject this and let it be handled as an external server
      if (lastOctet === 1) {
        this.logWithRateLimit(
          `docker-gateway-reject-${address}:${port}`,
          `Rejecting Docker gateway IP ${address}:${port} - likely external server routed through Docker`,
          "warn",
        )
        return null
      }
    }

    // Fallback: Use first Docker server (for backward compatibility)
    const fallbackServer = dockerServers[0]
    if (fallbackServer) {
      this.logWithRateLimit(
        `docker-fallback-${address}`,
        `Using fallback match for ${address} to server ${fallbackServer.serverId} (${fallbackServer.name})`,
        "info",
      )
      return fallbackServer
    }

    return null
  }

  private mapAuthenticationResult(result: AuthenticationResult): number | null {
    switch (result.kind) {
      case "authenticated":
        return result.serverId
      case "unauthorized":
        return null
      default: {
        const _exhaustive: never = result
        throw new Error(`Unhandled authentication result: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  private async authenticateServerInternal(
    address: string,
    port: number,
  ): Promise<AuthenticationResult> {
    const serverKey = `${address}:${port}`

    // Check cache first
    if (this.authenticatedServers.has(serverKey)) {
      const serverId = this.authenticatedServers.get(serverKey)!
      return { kind: "authenticated", serverId }
    }

    // Look up server in database
    try {
      // First try exact match (works for external servers)
      let server = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: { serverId: true },
      })

      // If no match and it's a Docker network IP, try to find Docker servers
      if (!server && this.isDockerNetwork(address)) {
        this.logWithRateLimit(
          `docker-detection-${address}:${port}`,
          `Docker network detected for ${address}:${port}, attempting Docker server lookup`,
          "info",
        )

        // Smart Docker server matching strategy
        // Different approaches for different IP patterns
        const dockerServer = await this.matchDockerServer(address, port)

        if (dockerServer) {
          server = dockerServer
          this.logWithRateLimit(
            `docker-auth-${address}:${port}`,
            `Authenticated Docker server from ${address}:${port} as ID ${dockerServer.serverId} (${dockerServer.name})`,
            "info",
          )
        } else {
          this.logger.debug(`No matching Docker server found for ${address}:${port}`)
        }
      }

      if (server) {
        const isNewAuthentication = !this.authenticatedServers.has(serverKey)
        this.authenticatedServers.set(serverKey, server.serverId)
        this.logWithRateLimit(
          `auth-success-${serverKey}`,
          `Authenticated server ${serverKey} as ID ${server.serverId}`,
          "ok",
        )

        // Emit event for new authentications
        if (isNewAuthentication) {
          try {
            const event: ServerAuthenticatedEvent = {
              eventType: EventType.SERVER_AUTHENTICATED,
              timestamp: new Date(),
              serverId: server.serverId,
            }
            await this.eventBus.emit(event)
          } catch (error) {
            this.logger.warn(`Error emitting server authentication event: ${error}`)
          }
        }

        return { kind: "authenticated", serverId: server.serverId }
      } else {
        this.logWithRateLimit(
          `auth-reject-${serverKey}`,
          `Unknown server attempted connection: ${serverKey}`,
          "warn",
        )
        return { kind: "unauthorized" }
      }
    } catch (error) {
      this.logger.error(`Database error during server authentication: ${error}`)
      return { kind: "unauthorized" }
    }
  }

  async cacheServer(address: string, port: number, serverId: number): Promise<void> {
    const serverKey = `${address}:${port}`
    this.authenticatedServers.set(serverKey, serverId)
    this.logger.debug(`Cached server ${serverKey} as ID ${serverId}`)
  }

  /**
   * Get currently authenticated server IDs
   * Useful for RCON monitoring to discover active servers
   */
  getAuthenticatedServerIds(): number[] {
    return Array.from(this.authenticatedServers.values())
  }

  /**
   * Clear authentication cache
   */
  clearCache(): void {
    this.authenticatedServers.clear()
    this.loggedMessages.clear()
  }

  /**
   * Log message with rate limiting to prevent spam
   * Only logs the first occurrence and subsequent occurrences after cooldown period
   */
  private logWithRateLimit(
    messageKey: string,
    message: string,
    level: "info" | "warn" | "debug" | "ok" = "info",
  ): void {
    const now = Date.now()
    const lastLogTime = this.loggedMessages.get(messageKey)

    if (!lastLogTime) {
      // First occurrence - log it
      this.logger[level](message)
      this.loggedMessages.set(messageKey, now)
    } else if (now - lastLogTime > this.LOG_COOLDOWN) {
      // Cooldown period has passed - log again and reset timer
      const suppressedMinutes = Math.round(this.LOG_COOLDOWN / 60000)
      this.logger[level](`${message} (suppressed for ${suppressedMinutes} minutes)`)
      this.loggedMessages.set(messageKey, now)
    }
    // Otherwise, silently ignore (no logging)
  }
}
