/**
 * Ingress Adapter
 *
 * Adapts existing services to the minimal interfaces required by IngressService.
 * This implements the Adapter pattern to decouple IngressService from concrete implementations.
 */

import type {
  IServerAuthenticator,
  IGameDetector,
  IServerInfoProvider,
  IngressDependencies,
} from "./ingress.dependencies"
import type { DatabaseClient } from "@/database/client"
import type { IGameDetectionService } from "@/modules/game/game-detection.types"
import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { GameDetectionResult } from "@/modules/game/game-detection.types"

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
    const serverKey = `${address}:${port}`

    // Check cache first
    if (this.authenticatedServers.has(serverKey)) {
      return this.authenticatedServers.get(serverKey)!
    }

    // In skip auth mode (development), always return a default server ID
    if (this.skipAuth) {
      // Will be handled by the server info provider
      return -1 // Special ID indicating development mode
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
        return server.serverId
      } else {
        this.logger.warn(`Unknown server attempted connection: ${serverKey}`)
        return null
      }
    } catch (error) {
      this.logger.error(`Database error during server authentication: ${error}`)
      return null
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

/**
 * Server information provider implementation
 */
export class ServerInfoProviderAdapter implements IServerInfoProvider {
  constructor(
    private readonly database: DatabaseClient,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {}

  async getServerGame(serverId: number): Promise<string> {
    // Handle development mode special ID
    if (serverId === -1) {
      return "css" // Default game for development
    }

    return this.serverService.getServerGame(serverId)
  }

  async findOrCreateServer(
    address: string,
    port: number,
    gameCode: string,
  ): Promise<{ serverId: number }> {
    try {
      let server = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: { serverId: true },
      })

      if (!server) {
        try {
          server = await this.database.prisma.server.create({
            data: {
              game: gameCode,
              address,
              port,
              publicaddress: `${address}:${port}`,
              name: `Dev Server ${address}:${port}`,
              rcon_password: "",
              sortorder: 0,
              act_players: 0,
              max_players: 0,
            },
            select: { serverId: true },
          })
          
          this.logger.info(
            `Auto-created development server ${address}:${port} with ID ${server.serverId} (game: ${gameCode})`,
          )
        } catch (createError) {
          // Handle race condition - another process might have created the server
          if (createError instanceof Error && createError.message.includes("Unique constraint failed")) {
            this.logger.debug(
              `Race condition detected creating server ${address}:${port}, fetching existing server`,
            )
            
            // Try to find the server that was created by another process
            server = await this.database.prisma.server.findFirst({
              where: { address, port },
              select: { serverId: true },
            })
            
            if (!server) {
              throw new Error(`Server ${address}:${port} still not found after unique constraint error`)
            }
          } else {
            throw createError
          }
        }
      }

      return server
    } catch (error) {
      throw new Error(`Failed to find or create server: ${error}`)
    }
  }
}

/**
 * Game detector adapter
 */
export class GameDetectorAdapter implements IGameDetector {
  constructor(private readonly gameDetectionService: IGameDetectionService) {}

  async detectGame(
    address: string,
    port: number,
    logSamples: string[],
  ): Promise<GameDetectionResult> {
    return this.gameDetectionService.detectGame(address, port, logSamples)
  }
}

/**
 * Create ingress dependencies from existing services
 */
export function createIngressDependencies(
  database: DatabaseClient,
  serverService: IServerService,
  gameDetectionService: IGameDetectionService,
  logger: ILogger,
  options: { skipAuth?: boolean } = {},
): IngressDependencies {
  return {
    serverAuthenticator: new DatabaseServerAuthenticator(
      database,
      logger,
      options.skipAuth ?? false,
    ),
    gameDetector: new GameDetectorAdapter(gameDetectionService),
    serverInfoProvider: new ServerInfoProviderAdapter(database, serverService, logger),
  }
}