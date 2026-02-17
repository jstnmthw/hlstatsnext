/**
 * Server Orchestrator
 *
 * Main orchestrator for server finding and creation operations.
 */
import type { DatabaseClient } from "@/database/client"
import type { IServerInfoProvider } from "@/modules/ingress/ingress.dependencies"
import type { IServerService } from "@/modules/server/server.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Prisma } from "@repo/db/client"

import { validateAddress } from "@/shared/application/validators/address-validator"
import { validateGameCode } from "@/shared/application/validators/game-code-validator"
import { validatePort } from "@/shared/application/validators/port-validator"
import { GeoIpEnricher } from "../enrichers/geoip-enricher"
import { ServerFactory } from "../factories/server-factory"

/**
 * Server orchestrator that coordinates server operations
 */
export class ServerOrchestrator implements IServerInfoProvider {
  private readonly pendingCreations = new Map<string, Promise<{ serverId: number }>>()
  private readonly serverFactory: ServerFactory
  private readonly geoIpEnricher: GeoIpEnricher

  constructor(
    private readonly database: DatabaseClient,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
  ) {
    this.serverFactory = new ServerFactory(database, logger)
    this.geoIpEnricher = new GeoIpEnricher(database, logger)
  }

  async getServerGame(serverId: number): Promise<string> {
    return this.serverService.getServerGame(serverId)
  }

  async findOrCreateServer(
    address: string,
    port: number,
    gameCode: string,
  ): Promise<{ serverId: number }> {
    // Validate inputs
    validateAddress(address)
    validatePort(port)
    validateGameCode(gameCode)

    const serverKey = `${address}:${port}`

    // Check if there's already a pending creation for this server
    const pendingCreation = this.pendingCreations.get(serverKey)
    if (pendingCreation) {
      return pendingCreation
    }

    // Create the server creation promise
    const creationPromise = this.createServerInternal(address, port, gameCode)

    // Store the promise to prevent concurrent creations
    this.pendingCreations.set(serverKey, creationPromise)

    try {
      const result = await creationPromise
      return result
    } finally {
      // Clean up the pending creation regardless of success/failure
      this.pendingCreations.delete(serverKey)
    }
  }

  private async createServerInternal(
    address: string,
    port: number,
    gameCode: string,
  ): Promise<{ serverId: number }> {
    try {
      const serverSelect = {
        serverId: true,
        city: true,
        country: true,
        lat: true,
        lng: true,
      } satisfies Prisma.ServerSelect

      // First, try to find existing server
      const existingServer = await this.database.prisma.server.findFirst({
        where: { address, port },
        select: serverSelect,
      })

      if (existingServer) {
        return { serverId: existingServer.serverId }
      }

      // Server doesn't exist, create it
      try {
        const newServer = await this.serverFactory.createNewServerWithDefaults(
          address,
          port,
          gameCode,
          serverSelect,
        )

        this.logger.info(
          `Auto-created server ${address}:${port} with ID ${newServer.serverId} (game: ${gameCode})`,
        )

        // Best-effort GeoIP enrichment for server location (outside transaction for performance)
        await this.geoIpEnricher.enrichServerWithGeoIP({
          address,
          port,
          serverId: newServer.serverId,
          currentCity: newServer.city,
          currentCountry: newServer.country,
          currentLat: newServer.lat,
          currentLng: newServer.lng,
        })

        return { serverId: newServer.serverId }
      } catch (createError) {
        // Handle race condition - another process might have created the server
        if (
          createError &&
          typeof createError === "object" &&
          "code" in createError &&
          (createError as { code: string }).code === "P2002"
        ) {
          this.logger.debug(
            `Race condition detected creating server ${address}:${port}, fetching existing server`,
          )

          // Try to find the server that was created by another process
          const existingServer = await this.database.prisma.server.findFirst({
            where: { address, port },
            select: serverSelect,
          })

          if (!existingServer) {
            throw new Error(
              `Server ${address}:${port} still not found after unique constraint error`,
            )
          }

          return { serverId: existingServer.serverId }
        } else {
          throw createError
        }
      }
    } catch (error) {
      throw new Error(`Failed to find or create server: ${error}`)
    }
  }
}
