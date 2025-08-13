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
      const server = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: { serverId: true },
      })

      if (server) {
        this.authenticatedServers.set(serverKey, server.serverId)
        this.logger.info(`Authenticated server ${serverKey} as ID ${server.serverId}`)
        return { kind: "authenticated", serverId: server.serverId }
      } else {
        this.logger.warn(`Unknown server attempted connection: ${serverKey}`)
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
  }
}
