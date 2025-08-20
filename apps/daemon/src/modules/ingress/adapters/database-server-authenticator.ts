/**
 * Database Server Authenticator
 *
 * Handles server authentication logic using database lookups and caching.
 */
import type { IServerAuthenticator } from "../ingress.dependencies"
import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { AuthenticationResult } from "../types/ingress.types"
import { INGRESS_CONSTANTS } from "../types/ingress.types"
import { validateAddress } from "@/shared/application/validators/address-validator"
import { validatePort } from "@/shared/application/validators/port-validator"

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
    private readonly skipAuth: boolean = false,
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

  private mapAuthenticationResult(result: AuthenticationResult): number | null {
    switch (result.kind) {
      case "authenticated":
        return result.serverId
      case "dev-mode":
        return INGRESS_CONSTANTS.DEV_AUTH_SENTINEL
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
      return serverId === INGRESS_CONSTANTS.DEV_AUTH_SENTINEL
        ? { kind: "dev-mode" }
        : { kind: "authenticated", serverId }
    }

    // In skip auth mode (development), return dev-mode result
    if (this.skipAuth) {
      return { kind: "dev-mode" }
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

        // For Docker servers, we need a more intelligent matching strategy
        // Since multiple Docker servers might exist, we need to identify which one is connecting
        // For now, we'll look for any Docker server that hasn't been matched yet
        // In production, you might want to use additional identifiers from log content
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

        // For now, use the first available Docker server
        // In a real implementation, you'd want to match based on game type or other identifiers
        if (dockerServers.length > 0) {
          const dockerServer = dockerServers[0]
          if (dockerServer) {
            server = dockerServer
            this.logWithRateLimit(
              `docker-auth-${address}:${port}`,
              `Authenticated Docker server from ${address}:${port} as ID ${dockerServer.serverId} (${dockerServer.name})`,
              "info",
            )
          }
        } else {
          this.logger.debug(`No Docker servers configured in database`)
        }
      }

      if (server) {
        this.authenticatedServers.set(serverKey, server.serverId)
        this.logWithRateLimit(
          `auth-success-${serverKey}`,
          `Authenticated server ${serverKey} as ID ${server.serverId}`,
          "info",
        )
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
    level: "info" | "warn" | "debug" = "info",
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
